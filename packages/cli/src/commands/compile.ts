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

export interface BridgeResult {
  bridgeId: string;
  outputPath: string;
  success: boolean;
  error?: string;
  content?: string;
}

export interface CompileResult {
  results: BridgeResult[];
  activeRuleCount: number;
  elapsedMs: number;
}

export interface PipelineOptions {
  cwd: string;
  tool?: string;
  write?: boolean;
}

const BRIDGES: Bridge[] = [claudeBridge, cursorBridge, geminiBridge, windsurfBridge, copilotBridge];

function getBridge(id: string): Bridge | undefined {
  return BRIDGES.find((b) => b.id === id);
}

export async function executePipeline(options: PipelineOptions): Promise<CompileResult> {
  const { cwd, tool, write = true } = options;
  const startTime = performance.now();

  const config = await readConfig(cwd);
  const rules = await readRules(cwd);

  let toolIds = config.tools;
  if (tool) {
    if (!config.tools.includes(tool)) {
      throw new Error(`Tool "${tool}" is not configured in .dwf/config.yml. Configured tools: ${config.tools.join(', ')}`);
    }
    toolIds = [tool];
  }

  const activeRules = rules.filter((r) => r.enabled);
  const results: BridgeResult[] = [];

  for (const toolId of toolIds) {
    const bridge = getBridge(toolId);
    if (!bridge) {
      continue;
    }

    try {
      if (activeRules.length === 0 && write) {
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
          results.push({ bridgeId: bridge.id, outputPath: relativePath, success: true });
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

        if (!write) {
          results.push({ bridgeId: bridge.id, outputPath: relativePath, success: true, content });
          continue;
        }

        const absolutePath = join(cwd, relativePath);
        await mkdir(dirname(absolutePath), { recursive: true });

        if (config.mode === 'link') {
          const cachePath = join(cwd, '.dwf', '.cache', relativePath);
          await mkdir(dirname(cachePath), { recursive: true });
          await writeFile(cachePath, content, 'utf-8');

          if (await fileExists(absolutePath)) {
            await unlink(absolutePath);
          }
          await symlink(cachePath, absolutePath);
        } else {
          await writeFile(absolutePath, content, 'utf-8');
        }

        results.push({ bridgeId: bridge.id, outputPath: relativePath, success: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const relativePath of bridge.outputPaths) {
        results.push({ bridgeId: bridge.id, outputPath: relativePath, success: false, error: message });
      }
    }
  }

  if (write) {
    const hash = computeRulesHash(activeRules);
    await writeHash(cwd, hash);
  }

  const elapsedMs = performance.now() - startTime;
  return { results, activeRuleCount: activeRules.length, elapsedMs };
}

async function runCompile(options: CompileOptions): Promise<void> {
  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  try {
    if (options.verbose) {
      const config = await readConfig(cwd);
      const rules = await readRules(cwd);
      ui.keyValue('Project:', chalk.bold(config.project.name));
      ui.keyValue('Mode:', config.mode);
      ui.keyValue('Rules:', String(rules.length));
      const toolIds = options.tool ? [options.tool] : config.tools;
      ui.keyValue('Tools:', chalk.cyan(toolIds.join(', ')));
      ui.newline();
    }

    if (options.dryRun) {
      const result = await executePipeline({ cwd, tool: options.tool, write: false });
      for (const br of result.results) {
        if (br.content !== undefined) {
          console.log(chalk.cyan(`--- ${br.outputPath} ---`));
          console.log(br.content);
        }
      }
      return;
    }

    const result = await executePipeline({ cwd, tool: options.tool });
    const writtenPaths = result.results.filter((r) => r.success).map((r) => r.outputPath);

    ui.newline();
    ui.success(`Compiled ${String(result.activeRuleCount)} rules ${ICONS.arrow} ${String(writtenPaths.length)} file${writtenPaths.length !== 1 ? 's' : ''} ${ui.timing(result.elapsedMs)}`);
    ui.newline();
    ui.list(writtenPaths);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ui.error(message);
    process.exitCode = 1;
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
