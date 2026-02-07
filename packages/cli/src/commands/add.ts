import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { loadAllBlocks, loadBlock } from '../blocks/registry.js';
import { installBlock } from '../blocks/installer.js';
import { fileExists } from '../utils/fs.js';

export interface AddOptions {
  list?: boolean;
  noCompile?: boolean;
}

async function listAvailableBlocks(): Promise<void> {
  const blocks = await loadAllBlocks();

  if (blocks.length === 0) {
    console.log(chalk.yellow('No blocks available.'));
    return;
  }

  console.log(chalk.bold('Available blocks:\n'));
  for (const block of blocks) {
    console.log(`  ${chalk.cyan(block.id)} — ${block.description}`);
    console.log(`  ${chalk.dim(`${String(block.rules.length)} rules | v${block.version}`)}`);
    console.log('');
  }
}

async function runAdd(blockId: string | undefined, options: AddOptions): Promise<void> {
  if (options.list || !blockId) {
    await listAvailableBlocks();
    return;
  }

  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    console.error(chalk.red('Error: .dwf/config.yml not found.'));
    console.error('Run "devw init" first.');
    process.exitCode = 1;
    return;
  }

  const block = await loadBlock(blockId);
  if (!block) {
    console.error(chalk.red(`Error: block "${blockId}" not found.`));
    console.error('Run "devw add --list" to see available blocks.');
    process.exitCode = 1;
    return;
  }

  const rulesAdded = await installBlock(cwd, block);
  console.log(chalk.green(`Added block "${block.name}" (${String(rulesAdded)} rules).`));

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
