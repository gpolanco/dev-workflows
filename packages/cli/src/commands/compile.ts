import { mkdir, writeFile, readFile, symlink, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { readConfig, readRules } from '../core/parser.js';
import { computeRulesHash, writeHash } from '../core/hash.js';
import type { Bridge } from '../bridges/types.js';
import { claudeBridge } from '../bridges/claude.js';
import { cursorBridge } from '../bridges/cursor.js';
import { geminiBridge } from '../bridges/gemini.js';
import { windsurfBridge } from '../bridges/windsurf.js';
import { copilotBridge } from '../bridges/copilot.js';
import { mergeMarkedContent, removeMarkedBlock } from '../core/markers.js';
import { fileExists } from '../utils/fs.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';

export interface CompileOptions {
  tool?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

const BRIDGES: Bridge[] = [claudeBridge, cursorBridge, geminiBridge, windsurfBridge, copilotBridge];

function getBridge(id: string): Bridge | undefined {
  return BRIDGES.find((b) => b.id === id);
}

async function runCompile(options: CompileOptions): Promise<void> {
  const cwd = process.cwd();
  const startTime = performance.now();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);
  const rules = await readRules(cwd);

  // Determine which tools to compile
  let toolIds = config.tools;
  if (options.tool) {
    if (!config.tools.includes(options.tool)) {
      ui.error(`Tool "${options.tool}" is not configured in .dwf/config.yml`, `Configured tools: ${config.tools.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    toolIds = [options.tool];
  }

  if (options.verbose) {
    ui.keyValue('Project:', chalk.bold(config.project.name));
    ui.keyValue('Mode:', config.mode);
    ui.keyValue('Rules:', String(rules.length));
    ui.keyValue('Tools:', chalk.cyan(toolIds.join(', ')));
    ui.newline();
  }

  const activeRules = rules.filter((r) => r.enabled);

  let filesWritten = 0;
  const writtenPaths: string[] = [];

  for (const toolId of toolIds) {
    const bridge = getBridge(toolId);
    if (!bridge) {
      ui.warn(`No bridge for tool "${toolId}", skipping`);
      continue;
    }

    // When zero active rules, clean up output files instead of writing empty content
    if (activeRules.length === 0 && !options.dryRun) {
      for (const relativePath of bridge.outputPaths) {
        const absolutePath = join(cwd, relativePath);
        if (!(await fileExists(absolutePath))) continue;

        if (bridge.usesMarkers) {
          const existing = await readFile(absolutePath, 'utf-8');
          const cleaned = removeMarkedBlock(existing);
          if (cleaned.length === 0) {
            await unlink(absolutePath);
          } else {
            await writeFile(absolutePath, cleaned + '\n', 'utf-8');
          }
        } else {
          await unlink(absolutePath);
        }
        writtenPaths.push(relativePath);
        filesWritten++;
      }
      continue;
    }

    const outputs = bridge.compile(rules, config);

    for (const [relativePath, rawContent] of outputs) {
      let content = rawContent;
      if (bridge.usesMarkers) {
        const absoluteCheck = join(cwd, relativePath);
        let existing: string | null = null;
        try {
          existing = await readFile(absoluteCheck, 'utf-8');
        } catch {
          existing = null;
        }
        content = mergeMarkedContent(existing, rawContent);
      }

      if (options.dryRun) {
        console.log(chalk.cyan(`--- ${relativePath} ---`));
        console.log(content);
        continue;
      }

      const absolutePath = join(cwd, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });

      if (config.mode === 'link') {
        // Write to .dwf/.cache/, then symlink
        const cachePath = join(cwd, '.dwf', '.cache', relativePath);
        await mkdir(dirname(cachePath), { recursive: true });
        await writeFile(cachePath, content, 'utf-8');

        // Remove existing file/symlink before creating new one
        if (await fileExists(absolutePath)) {
          await unlink(absolutePath);
        }
        await symlink(cachePath, absolutePath);
      } else {
        await writeFile(absolutePath, content, 'utf-8');
      }

      writtenPaths.push(relativePath);
      filesWritten++;
    }
  }

  if (!options.dryRun) {
    const hash = computeRulesHash(activeRules);
    await writeHash(cwd, hash);

    const elapsed = performance.now() - startTime;
    ui.newline();
    ui.success(`Compiled ${String(activeRules.length)} rules ${ICONS.arrow} ${String(filesWritten)} file${filesWritten !== 1 ? 's' : ''} ${ui.timing(elapsed)}`);
    ui.newline();
    ui.list(writtenPaths);
  }
}

export async function runCompileFromAdd(): Promise<void> {
  await runCompile({});
}

export function registerCompileCommand(program: Command): void {
  program
    .command('compile')
    .description('Compile .dwf/ rules into editor-specific config files')
    .option('--tool <tool>', 'Compile only a specific bridge (claude, cursor, gemini, windsurf, copilot)')
    .option('--dry-run', 'Show output without writing files')
    .option('--verbose', 'Show detailed output')
    .action((options: CompileOptions) => runCompile(options));
}
