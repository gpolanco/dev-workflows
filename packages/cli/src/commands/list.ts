import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { readConfig, readRules } from '../core/parser.js';
import { fileExists } from '../utils/fs.js';

async function ensureConfig(cwd: string): Promise<boolean> {
  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    console.error(chalk.red('Error: .dwf/config.yml not found.'));
    console.error('Run "devw init" first.');
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
    console.log(chalk.yellow('No rules found.'));
    return;
  }

  const active = rules.filter((r) => r.enabled);
  if (active.length === 0) {
    console.log(chalk.yellow('No active rules found.'));
    return;
  }

  console.log(chalk.bold(`Active rules (${String(active.length)}):\n`));
  for (const rule of active) {
    const severityColor = rule.severity === 'error' ? chalk.red : rule.severity === 'warning' ? chalk.yellow : chalk.dim;
    const source = rule.sourceBlock ? chalk.dim(` [${rule.sourceBlock}]`) : '';
    console.log(`  ${severityColor(rule.severity.padEnd(7))} ${chalk.cyan(rule.scope.padEnd(14))} ${rule.id}${source}`);
  }
}

async function listBlocks(): Promise<void> {
  const cwd = process.cwd();
  if (!(await ensureConfig(cwd))) return;

  const config = await readConfig(cwd);

  if (config.blocks.length === 0) {
    console.log(chalk.yellow('No blocks installed.'));
    console.log(chalk.dim('Run "devw add --list" to see available blocks.'));
    return;
  }

  console.log(chalk.bold(`Installed blocks (${String(config.blocks.length)}):\n`));
  for (const blockId of config.blocks) {
    console.log(`  ${chalk.cyan(blockId)}`);
  }
}

async function listTools(): Promise<void> {
  const cwd = process.cwd();
  if (!(await ensureConfig(cwd))) return;

  const config = await readConfig(cwd);

  if (config.tools.length === 0) {
    console.log(chalk.yellow('No tools configured.'));
    return;
  }

  console.log(chalk.bold(`Configured tools (${String(config.tools.length)}):\n`));
  for (const tool of config.tools) {
    console.log(`  ${chalk.cyan(tool)}`);
  }
}

async function runList(subcommand: string | undefined): Promise<void> {
  if (!subcommand) {
    console.error(chalk.red('Error: specify what to list.'));
    console.error('Usage: devw list <rules|blocks|tools>');
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
    default:
      console.error(chalk.red(`Error: unknown list type "${subcommand}".`));
      console.error('Usage: devw list <rules|blocks|tools>');
      process.exitCode = 1;
  }
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .argument('[type]', 'What to list: rules, blocks, or tools')
    .description('List rules, installed blocks, or configured tools')
    .action((type: string | undefined) => runList(type));
}
