import type { Command } from 'commander';
import pc from 'picocolors';
import { readConfig, readRules } from '../core/parser.js';
import { resolveContext } from '../core/resolve-context.js';
import { claudeBridge } from '../bridges/claude.js';
import { cursorBridge } from '../bridges/cursor.js';
import { geminiBridge } from '../bridges/gemini.js';
import { windsurfBridge } from '../bridges/windsurf.js';
import { copilotBridge } from '../bridges/copilot.js';
import type { Bridge } from '../bridges/types.js';
import { ASSET_TYPE, isDirectoryBridge, getBridgeOutputPaths } from '../bridges/types.js';
import { filterRules, groupByScope } from '../core/helpers.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';

const BRIDGES: Bridge[] = [claudeBridge, cursorBridge, geminiBridge, windsurfBridge, copilotBridge];

async function ensureConfig(): Promise<string | null> {
  const resolved = await resolveContext(process.cwd());
  if (!resolved) {
    ui.error('No devw configuration found.', 'Run "devw init" to set up a project or global configuration.');
    process.exitCode = 1;
    return null;
  }
  return resolved.configRoot;
}

async function listRules(): Promise<void> {
  const cwd = await ensureConfig();
  if (!cwd) {
    return;
  }

  let rules;
  try {
    rules = await readRules(cwd);
  } catch {
    ui.warn('No rules found');
    return;
  }

  const active = rules.filter((r) => r.enabled);
  if (active.length === 0) {
    ui.warn('No active rules found');
    return;
  }

  ui.header(`Active rules (${String(active.length)})`);
  ui.newline();
  for (const rule of active) {
    const severityIcon = rule.severity === 'error' ? pc.red(ICONS.error) : rule.severity === 'warning' ? pc.yellow(ICONS.warn) : pc.dim(ICONS.dot);
    const severityColor = rule.severity === 'error' ? pc.red : rule.severity === 'warning' ? pc.yellow : pc.dim;
    let source = '';
    if (rule.source) {
      source = pc.dim(` (pulled: ${rule.source})`);
    } else if (rule.sourceBlock) {
      source = pc.dim(` [${rule.sourceBlock}]`);
    } else {
      source = pc.dim(` ${ICONS.arrow} manual`);
    }
    console.log(`    ${severityIcon} ${severityColor(rule.severity.padEnd(8))}${pc.cyan(rule.scope.padEnd(15))}${rule.id}${source}`);
  }
}

async function listBlocks(): Promise<void> {
  ui.warn('Blocks have been replaced by pulled rules');
  ui.info('Run devw list rules to see installed rules');
  ui.info('Run devw add --list to browse available rules');
}

async function listTools(): Promise<void> {
  const cwd = await ensureConfig();
  if (!cwd) {
    return;
  }

  const config = await readConfig(cwd);
  let activeScopeCount = 0;
  try {
    const rules = await readRules(cwd);
    activeScopeCount = groupByScope(filterRules(rules)).size;
  } catch {
    activeScopeCount = 0;
  }

  if (config.tools.length === 0) {
    ui.warn('No tools configured');
    return;
  }

  ui.header(`Configured tools (${String(config.tools.length)})`);
  ui.newline();
  for (const tool of config.tools) {
    const bridge = BRIDGES.find((b) => b.id === tool);
    let outputLabel: string | undefined;
    if (bridge) {
      if (isDirectoryBridge(bridge)) {
        outputLabel = `${bridge.outputDir}/${bridge.filePrefix}*${bridge.fileExtension} (${String(activeScopeCount)} file${activeScopeCount === 1 ? '' : 's'})`;
      } else {
        const paths = getBridgeOutputPaths(bridge);
        outputLabel = paths[0];
      }
    }
    if (outputLabel) {
      console.log(`    ${pc.dim(ICONS.bullet)} ${pc.cyan(tool.padEnd(12))}${pc.dim(ICONS.arrow)} ${pc.dim(outputLabel)}`);
    } else {
      console.log(`    ${pc.dim(ICONS.bullet)} ${pc.cyan(tool)}`);
    }
  }
}

function getAssetOutputHint(type: string, name: string): string {
  switch (type) {
    case ASSET_TYPE.Command:
      return `.claude/commands/${name}.md`;
    case ASSET_TYPE.Template:
      return `docs/specs/${name}.md`;
    case ASSET_TYPE.Hook:
      return `.claude/settings.local.json`;
    default:
      return '';
  }
}

async function listAssets(typeFilter?: string): Promise<void> {
  const cwd = await ensureConfig();
  if (!cwd) {
    return;
  }

  const config = await readConfig(cwd);

  const filtered = typeFilter
    ? config.assets.filter((a) => a.type === typeFilter || `${a.type}s` === typeFilter)
    : config.assets;

  if (filtered.length === 0) {
    const label = typeFilter ?? 'assets';
    ui.warn(`No ${label} installed`);
    ui.info('Run devw add command/<name> or devw add preset/<name> to install');
    return;
  }

  const label = typeFilter ?? 'assets';
  ui.header(`Installed ${label} (${String(filtered.length)})`);
  ui.newline();
  for (const asset of filtered) {
    const outputHint = getAssetOutputHint(asset.type, asset.name);
    console.log(`    ${pc.dim(ICONS.bullet)} ${pc.cyan(asset.type.padEnd(10))} ${pc.white(asset.name.padEnd(20))} ${pc.dim(`v${asset.version}`)}  ${pc.dim(ICONS.arrow)} ${pc.dim(outputHint)}`);
  }
}

async function runList(subcommand: string | undefined): Promise<void> {
  if (!subcommand) {
    ui.error('Specify what to list', 'Usage: devw list <rules|tools|assets|commands|templates|hooks>');
    process.exitCode = 1;
    return;
  }

  switch (subcommand) {
    case 'rules':
      await listRules();
      break;
    case 'blocks':
      await listBlocks();
      break;
    case 'tools':
      await listTools();
      break;
    case 'assets':
      await listAssets();
      break;
    case 'commands':
      await listAssets(ASSET_TYPE.Command);
      break;
    case 'templates':
      await listAssets(ASSET_TYPE.Template);
      break;
    case 'hooks':
      await listAssets(ASSET_TYPE.Hook);
      break;
    default:
      ui.error(`Unknown list type "${subcommand}"`, 'Usage: devw list <rules|tools|assets|commands|templates|hooks>');
      process.exitCode = 1;
  }
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .argument('[type]', 'What to list: rules, tools, assets, commands, templates, hooks')
    .description('List rules, configured tools, or installed assets')
    .action((type: string | undefined) => runList(type));
}
