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
import { mergeMarkedContent } from '../core/markers.js';
import { fileExists } from '../utils/fs.js';

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

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    console.error(chalk.red('Error: .dwf/config.yml not found.'));
    console.error('Run "devw init" first.');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);
  const rules = await readRules(cwd);

  // Determine which tools to compile
  let toolIds = config.tools;
  if (options.tool) {
    if (!config.tools.includes(options.tool)) {
      console.error(chalk.red(`Error: tool "${options.tool}" is not configured in .dwf/config.yml`));
      console.error(`Configured tools: ${config.tools.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    toolIds = [options.tool];
  }

  if (options.verbose) {
    console.log(chalk.dim(`Project: ${config.project.name}`));
    console.log(chalk.dim(`Mode: ${config.mode}`));
    console.log(chalk.dim(`Rules loaded: ${String(rules.length)}`));
    console.log(chalk.dim(`Tools: ${toolIds.join(', ')}`));
    console.log('');
  }

  const activeRules = rules.filter((r) => r.enabled);
  if (activeRules.length === 0) {
    console.log(chalk.yellow('No active rules found in .dwf/rules/. Nothing to compile.'));
    return;
  }

  let filesWritten = 0;

  for (const toolId of toolIds) {
    const bridge = getBridge(toolId);
    if (!bridge) {
      console.warn(chalk.yellow(`Warning: no bridge for tool "${toolId}", skipping.`));
      continue;
    }

    const outputs = bridge.compile(rules, config);

    for (const [relativePath, rawContent] of outputs) {
      let content = rawContent;
      if (bridge.usesMarkers && !options.dryRun) {
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

        if (options.verbose) {
          console.log(`  ${chalk.dim(relativePath)} -> ${chalk.dim(`.dwf/.cache/${relativePath}`)}`);
        }
      } else {
        await writeFile(absolutePath, content, 'utf-8');

        if (options.verbose) {
          console.log(`  ${chalk.dim(relativePath)}`);
        }
      }

      filesWritten++;
    }
  }

  if (!options.dryRun) {
    const hash = computeRulesHash(activeRules);
    await writeHash(cwd, hash);

    console.log('');
    console.log(chalk.green(`Compiled ${String(filesWritten)} file${filesWritten !== 1 ? 's' : ''} successfully.`));
    if (options.verbose) {
      console.log(chalk.dim(`Mode: ${config.mode}`));
    }
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
