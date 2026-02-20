import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { readConfig, readRules } from '../core/parser.js';
import { fileExists } from '../utils/fs.js';
import { claudeBridge } from '../bridges/claude.js';
import { cursorBridge } from '../bridges/cursor.js';
import { geminiBridge } from '../bridges/gemini.js';
import { windsurfBridge } from '../bridges/windsurf.js';
import { copilotBridge } from '../bridges/copilot.js';
import type { Bridge } from '../bridges/types.js';
import { ASSET_TYPE } from '../bridges/types.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';

const BRIDGES: Bridge[] = [claudeBridge, cursorBridge, geminiBridge, windsurfBridge, copilotBridge];

async function ensureConfig(cwd: string): Promise<boolean> {
  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function listRules(): Promise<void> {
  const cwd = process.cwd();
  if (!(await ensureConfig(cwd))) return;

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
    const severityIcon = rule.severity === 'error' ? chalk.red(ICONS.error) : rule.severity === 'warning' ? chalk.yellow(ICONS.warn) : chalk.dim(ICONS.dot);
    const severityColor = rule.severity === 'error' ? chalk.red : rule.severity === 'warning' ? chalk.yellow : chalk.dim;
    let source = '';
    if (rule.source) {
      source = chalk.dim(` (pulled: ${rule.source})`);
    } else if (rule.sourceBlock) {
      source = chalk.dim(` [${rule.sourceBlock}]`);
    } else {
      source = chalk.dim(` ${ICONS.arrow} manual`);
    }
    console.log(`    ${severityIcon} ${severityColor(rule.severity.padEnd(8))}${chalk.cyan(rule.scope.padEnd(15))}${rule.id}${source}`);
  }
}

async function listBlocks(): Promise<void> {
  ui.warn('Blocks have been replaced by pulled rules');
  ui.info('Run devw list rules to see installed rules');
  ui.info('Run devw add --list to browse available rules');
}

async function listTools(): Promise<void> {
  const cwd = process.cwd();
  if (!(await ensureConfig(cwd))) return;

  const config = await readConfig(cwd);

  if (config.tools.length === 0) {
    ui.warn('No tools configured');
    return;
  }

  ui.header(`Configured tools (${String(config.tools.length)})`);
  ui.newline();
  for (const tool of config.tools) {
    const bridge = BRIDGES.find((b) => b.id === tool);
    const outputPath = bridge?.outputPaths[0];
    if (outputPath) {
      console.log(`    ${chalk.dim(ICONS.bullet)} ${chalk.cyan(tool.padEnd(12))}${chalk.dim(ICONS.arrow)} ${chalk.dim(outputPath)}`);
    } else {
      console.log(`    ${chalk.dim(ICONS.bullet)} ${chalk.cyan(tool)}`);
    }
  }
}

async function listAssets(typeFilter?: string): Promise<void> {
  const cwd = process.cwd();
  if (!(await ensureConfig(cwd))) return;

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
    console.log(`    ${chalk.dim(ICONS.bullet)} ${chalk.cyan(asset.type.padEnd(10))} ${chalk.white(asset.name.padEnd(20))} ${chalk.dim(`v${asset.version}`)}`);
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
