import { mkdir, writeFile, readFile, symlink, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { Command } from 'commander';
import pc from 'picocolors';
import { readConfig, readConfigFromDwfDir, readRules } from '../core/parser.js';
import { mergeRules } from '../core/merge.js';
import { computeRulesHash, writeHash } from '../core/hash.js';
import { deployAssets } from '../core/assets.js';
import type { Bridge, DirectoryBridge, Rule } from '../bridges/types.js';
import { isDirectoryBridge, getBridgeOutputPaths } from '../bridges/types.js';
import { claudeBridge } from '../bridges/claude.js';
import { cursorBridge } from '../bridges/cursor.js';
import { geminiBridge } from '../bridges/gemini.js';
import { windsurfBridge } from '../bridges/windsurf.js';
import { copilotBridge } from '../bridges/copilot.js';
import { mergeMarkedContent, removeMarkedBlock } from '../core/markers.js';
import { cleanStaleFiles } from '../core/scope-filename.js';
import { detectLegacyFiles, migrateLegacyFiles, detectCanonicalDir, removeCanonicalDir } from '../core/cleanup.js';
import { fileExists } from '../utils/fs.js';
import { resolveContext } from '../core/resolve-context.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';
import { renderTable } from '../utils/table.js';

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

export interface StaleFileResult {
  bridgeId: string;
  deleted: string[];
}

export interface MigrationResult {
  actions: string[];
}

export interface CompileResult {
  results: BridgeResult[];
  activeRuleCount: number;
  globalRuleCount: number;
  projectRuleCount: number;
  overriddenRuleIds: string[];
  assetPaths: string[];
  elapsedMs: number;
  staleResults: StaleFileResult[];
  migration: MigrationResult;
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

function extractFilenameFromPath(relativePath: string): string {
  const parts = relativePath.split('/');
  return parts[parts.length - 1] ?? relativePath;
}

async function handleDirectoryBridgeCleanup(
  outputRoot: string,
  bridge: DirectoryBridge,
  writtenFilenames: Set<string>,
  write: boolean,
): Promise<string[]> {
  if (!write) {
    return [];
  }

  const outputDir = join(outputRoot, bridge.outputDir);
  return cleanStaleFiles(outputDir, bridge.filePrefix, bridge.fileExtension, writtenFilenames);
}

interface CompileContext {
  configRoot: string;
  outputRoot: string;
  globalMode: boolean;
  dwfDir: string;
}

function toCompileSummaryRows(result: CompileResult): string[][] {
  const counts = new Map<string, { success: number; failed: number }>();

  for (const output of result.results) {
    const current = counts.get(output.bridgeId) ?? { success: 0, failed: 0 };
    if (output.success) {
      current.success += 1;
    } else {
      current.failed += 1;
    }
    counts.set(output.bridgeId, current);
  }

  const rows: string[][] = [];
  for (const [bridgeId, count] of counts.entries()) {
    rows.push([
      bridgeId,
      String(count.success),
      String(count.failed),
    ]);
  }

  rows.sort((a, b) => a[0]!.localeCompare(b[0]!));
  return rows;
}

async function resolveCompileContext(cwd: string): Promise<CompileContext> {
  const resolved = await resolveContext(cwd);
  if (!resolved) {
    throw new Error('No devw configuration found.\nRun "devw init" to set up a project or global configuration.');
  }

  return {
    configRoot: resolved.configRoot,
    outputRoot: resolved.outputRoot,
    globalMode: resolved.globalMode,
    dwfDir: resolved.dwfDir,
  };
}

export async function executePipeline(options: PipelineOptions): Promise<CompileResult> {
  const { cwd, tool, write = true } = options;
  const startTime = performance.now();
  const context = await resolveCompileContext(cwd);

  const config = context.globalMode ? await readConfigFromDwfDir(context.dwfDir) : await readConfig(context.configRoot);
  const projectRules = await readRules(context.configRoot);
  const globalRules = context.globalMode || config.global === false
    ? []
    : await readRules(context.configRoot, join(homedir(), '.dwf', 'rules'));
  const rules = mergeRules(globalRules, projectRules);
  const overriddenRuleIds = getOverriddenRuleIds(globalRules, projectRules);

  let toolIds = config.tools;
  if (tool) {
    if (!config.tools.includes(tool)) {
      throw new Error(`Tool "${tool}" is not configured in .dwf/config.yml. Configured tools: ${config.tools.join(', ')}`);
    }
    toolIds = [tool];
  }

  // Legacy migration — run ONCE before writing new files
  const migration: MigrationResult = { actions: [] };
  if (write) {
    const legacyFiles = await detectLegacyFiles(context.outputRoot);
    if (legacyFiles.length > 0) {
      const actions = await migrateLegacyFiles(context.outputRoot, legacyFiles);
      migration.actions = actions;
    }

    // Clean up old canonical directory if it exists
    const canonicalDir = await detectCanonicalDir(context.outputRoot);
    if (canonicalDir) {
      const removed = await removeCanonicalDir(context.outputRoot);
      if (removed) {
        migration.actions.push('Removed legacy .agents/rules/devw/ canonical directory');
      }
    }
  }

  const activeRules = rules.filter((r) => r.enabled);
  const results: BridgeResult[] = [];
  const staleResults: StaleFileResult[] = [];

  for (const toolId of toolIds) {
    const bridge = getBridge(toolId);
    if (!bridge) {
      continue;
    }

    try {
      if (isDirectoryBridge(bridge)) {
        // DirectoryBridge flow: multi-file output with stale cleanup
        if (activeRules.length === 0 && write) {
          // No active rules → clean all dwf- files from the output dir
          const deleted = await handleDirectoryBridgeCleanup(context.outputRoot, bridge, new Set(), write);
          if (deleted.length > 0) {
            staleResults.push({ bridgeId: bridge.id, deleted });
          }
          continue;
        }

        const outputs = bridge.compile(rules, config);
        const writtenFilenames = new Set<string>();

        for (const [relativePath, content] of outputs) {
          writtenFilenames.add(extractFilenameFromPath(relativePath));

          if (!write) {
            results.push({ bridgeId: bridge.id, outputPath: relativePath, success: true, content });
            continue;
          }

          const absolutePath = join(context.outputRoot, relativePath);
          await mkdir(dirname(absolutePath), { recursive: true });

          if (config.mode === 'link') {
            const cachePath = join(context.outputRoot, '.dwf', '.cache', relativePath);
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

        // Stale file cleanup for DirectoryBridge
        const deleted = await handleDirectoryBridgeCleanup(context.outputRoot, bridge, writtenFilenames, write);
        if (deleted.length > 0) {
          staleResults.push({ bridgeId: bridge.id, deleted });
        }
      } else {
        // MarkerBridge flow: merge content between markers in target file
        if (activeRules.length === 0 && write) {
          for (const relativePath of getBridgeOutputPaths(bridge)) {
            const absolutePath = join(context.outputRoot, relativePath);
            if (!(await fileExists(absolutePath))) {
              continue;
            }

            const existing = await readFile(absolutePath, 'utf-8');
            const cleaned = removeMarkedBlock(existing);
            if (cleaned.length === 0) {
              await unlink(absolutePath);
            } else {
              await writeFile(absolutePath, cleaned + '\n', 'utf-8');
            }
            results.push({ bridgeId: bridge.id, outputPath: relativePath, success: true });
          }
          continue;
        }

        const outputs = bridge.compile(rules, config);

        for (const [relativePath, rawContent] of outputs) {
          let content = rawContent;
          const absoluteCheck = join(context.outputRoot, relativePath);
          let existing: string | null = null;
          try {
            existing = await readFile(absoluteCheck, 'utf-8');
          } catch {
            existing = null;
          }
          content = mergeMarkedContent(existing, rawContent);

          if (!write) {
            results.push({ bridgeId: bridge.id, outputPath: relativePath, success: true, content });
            continue;
          }

          const absolutePath = join(context.outputRoot, relativePath);
          await mkdir(dirname(absolutePath), { recursive: true });

          if (config.mode === 'link') {
            const cachePath = join(context.outputRoot, '.dwf', '.cache', relativePath);
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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorPaths = getBridgeOutputPaths(bridge);
      if (errorPaths.length > 0) {
        for (const relativePath of errorPaths) {
          results.push({ bridgeId: bridge.id, outputPath: relativePath, success: false, error: message });
        }
      } else {
        results.push({ bridgeId: bridge.id, outputPath: bridge.id, success: false, error: message });
      }
    }
  }

  let assetPaths: string[] = [];
  if (write) {
    const hash = computeRulesHash(activeRules);
    await writeHash(context.outputRoot, hash);

    const assetResult = await deployAssets(context.outputRoot, config);
    assetPaths = assetResult.deployed;
  }

  const elapsedMs = performance.now() - startTime;
  return {
    results,
    activeRuleCount: activeRules.length,
    globalRuleCount: globalRules.length,
    projectRuleCount: projectRules.length,
    overriddenRuleIds,
    assetPaths,
    elapsedMs,
    staleResults,
    migration,
  };
}

export async function runCompile(options: CompileOptions): Promise<void> {
  const cwd = process.cwd();

  try {
    const context = await resolveCompileContext(cwd);

    if (options.verbose) {
      const config = context.globalMode ? await readConfigFromDwfDir(context.dwfDir) : await readConfig(context.configRoot);
      const projectRules = await readRules(context.configRoot);
      const globalRules = context.globalMode || config.global === false
        ? []
        : await readRules(context.configRoot, join(homedir(), '.dwf', 'rules'));
      const mergedRules = mergeRules(globalRules, projectRules);
      const overriddenRuleIds = getOverriddenRuleIds(globalRules, projectRules);

      ui.keyValue('Project:', pc.bold(config.project.name));
      ui.keyValue('Scope:', context.globalMode ? 'global (~/.dwf)' : 'project (.dwf)');
      ui.keyValue('Mode:', config.mode);
      ui.keyValue('Project rules:', String(projectRules.length));
      if (config.global === false) {
        ui.keyValue('Global rules:', 'disabled by config');
      } else {
        ui.keyValue('Global rules:', String(globalRules.length));
      }
      ui.keyValue('Merged rules:', String(mergedRules.length));
      if (overriddenRuleIds.length > 0) {
        ui.keyValue('Project overrides:', String(overriddenRuleIds.length));
      }
      const toolIds = options.tool ? [options.tool] : config.tools;
      ui.keyValue('Tools:', pc.cyan(toolIds.join(', ')));
      ui.newline();
    }

    if (options.dryRun) {
      const result = await executePipeline({ cwd, tool: options.tool, write: false });

      ui.newline();
      ui.info('Dry run — no files written');
      ui.newline();

      for (const br of result.results) {
        if (br.content !== undefined) {
          console.log(pc.cyan(`--- ${br.outputPath} ---`));
          console.log(br.content);
        }
      }

      // Summary of what would be generated
      const fileCount = result.results.filter((r) => r.success).length;
      ui.newline();
      ui.info(
        `Would generate ${String(fileCount)} file${fileCount !== 1 ? 's' : ''} from ${String(result.activeRuleCount)} rules`,
      );
      return;
    }

    const result = await executePipeline({ cwd, tool: options.tool });

    const summaryTable = renderTable(
      ['bridge', 'generated', 'failed'],
      toCompileSummaryRows(result),
      [10, 9, 6],
    );

    // Show migration messages if any
    if (result.migration.actions.length > 0) {
      ui.newline();
      ui.info('Migrating from single-file to multi-file output...');
      for (const action of result.migration.actions) {
        ui.info(`  ${action}`);
      }
    }

    const writtenPaths = result.results.filter((r) => r.success).map((r) => r.outputPath);
    const allPaths = [...writtenPaths, ...result.assetPaths];

    ui.newline();
    ui.success(`Compiled ${String(result.activeRuleCount)} rules ${ICONS.arrow} ${String(allPaths.length)} file${allPaths.length !== 1 ? 's' : ''} ${ui.timing(result.elapsedMs)}`);
    ui.log(summaryTable);
    if (options.verbose && result.overriddenRuleIds.length > 0) {
      ui.info(`Project overrides (${String(result.overriddenRuleIds.length)}): ${result.overriddenRuleIds.join(', ')}`);
    }
    ui.newline();

    if (options.verbose) {
      ui.list(writtenPaths);

      if (result.staleResults.length > 0) {
        ui.newline();
        console.log(`  ${pc.dim('Stale files removed:')}`);
        for (const stale of result.staleResults) {
          for (const deleted of stale.deleted) {
            ui.info(`  ${stale.bridgeId}: ${deleted}`);
          }
        }
      }

      if (result.assetPaths.length > 0) {
        ui.newline();
        console.log(`  ${pc.dim('Assets deployed:')}`);
        ui.list(result.assetPaths);
      }
    } else {
      ui.list(allPaths);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ui.error(message);
    process.exitCode = 1;
  }
}

export async function runCompileFromAdd(): Promise<void> {
  await runCompile({});
}

function getOverriddenRuleIds(globalRules: Rule[], projectRules: Rule[]): string[] {
  const globalIds = new Set<string>(globalRules.map((rule) => rule.id));
  const orderedOverrides: string[] = [];
  const seen = new Set<string>();

  for (const rule of projectRules) {
    if (!globalIds.has(rule.id) || seen.has(rule.id)) {
      continue;
    }
    seen.add(rule.id);
    orderedOverrides.push(rule.id);
  }

  return orderedOverrides;
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
