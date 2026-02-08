import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { loadAllBlocks, loadBlock } from '../blocks/registry.js';
import { installBlock } from '../blocks/installer.js';
import { fileExists } from '../utils/fs.js';
import { readConfig } from '../core/parser.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';

export interface AddOptions {
  list?: boolean;
  noCompile?: boolean;
}

async function listAvailableBlocks(): Promise<void> {
  const blocks = await loadAllBlocks();

  if (blocks.length === 0) {
    ui.warn('No blocks available');
    return;
  }

  // Try to load installed blocks from config
  let installedBlocks: string[] = [];
  try {
    const config = await readConfig(process.cwd());
    installedBlocks = config.blocks;
  } catch {
    // No config — that's fine, just don't show installed indicator
  }

  ui.header('Available blocks');
  ui.newline();
  for (const block of blocks) {
    const installed = installedBlocks.includes(block.id) ? chalk.green(` ${ICONS.success}`) + chalk.dim(' installed') : '';
    console.log(`${chalk.cyan(`    ${block.id}`)} ${chalk.dim(ICONS.dash)} ${block.description}${installed}`);
    console.log(`    ${chalk.dim(`${String(block.rules.length)} rules ${ICONS.dot} v${block.version}`)}`);
    ui.newline();
  }
}

async function selectBlock(installedBlocks: string[]): Promise<string | undefined> {
  const blocks = await loadAllBlocks();
  if (blocks.length === 0) {
    ui.warn('No blocks available');
    return undefined;
  }

  const available = blocks.filter((b) => !installedBlocks.includes(b.id));
  if (available.length === 0) {
    ui.success('All blocks already installed');
    return undefined;
  }

  try {
    return await select<string>({
      message: 'Which block to install?',
      choices: blocks.map((b) => {
        const installed = installedBlocks.includes(b.id);
        return {
          name: installed ? `${b.id} ${ICONS.success} installed` : `${b.id} ${ICONS.dash} ${b.description}`,
          value: b.id,
          disabled: installed,
        };
      }),
    });
  } catch {
    return undefined;
  }
}

async function runAdd(blockId: string | undefined, options: AddOptions): Promise<void> {
  if (options.list) {
    await listAvailableBlocks();
    return;
  }

  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  if (!blockId) {
    const config = await readConfig(cwd);
    const selected = await selectBlock(config.blocks);
    if (!selected) return;
    blockId = selected;
  }

  const block = await loadBlock(blockId);
  if (!block) {
    ui.error(`Block "${blockId}" not found`, 'Run devw add --list to see available blocks');
    process.exitCode = 1;
    return;
  }

  const rulesAdded = await installBlock(cwd, block);
  ui.success(`Added ${block.id} (${String(rulesAdded)} rules)`);

  if (!options.noCompile) {
    // Dynamic import to avoid circular dependency
    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
  }
}

export function registerAddCommand(program: Command): void {
  program
    .command('add')
    .argument('[block]', 'Block ID to install')
    .description('Install a prebuilt rule block')
    .option('--list', 'List all available blocks')
    .option('--no-compile', 'Skip auto-compile after adding')
    .action((blockId: string | undefined, options: AddOptions) => runAdd(blockId, options));
}
