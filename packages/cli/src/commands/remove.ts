import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { readConfig } from '../core/parser.js';
import { uninstallBlock } from '../blocks/installer.js';
import { fileExists } from '../utils/fs.js';

async function runRemove(blockId: string): Promise<void> {
  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    console.error(chalk.red('Error: .dwf/config.yml not found.'));
    console.error('Run "devw init" first.');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);
  if (!config.blocks.includes(blockId)) {
    console.error(chalk.red(`Error: block "${blockId}" is not installed.`));
    console.error(`Installed blocks: ${config.blocks.length > 0 ? config.blocks.join(', ') : '(none)'}`);
    process.exitCode = 1;
    return;
  }

  const rulesRemoved = await uninstallBlock(cwd, blockId);
  console.log(chalk.green(`Removed block "${blockId}" (${String(rulesRemoved)} rules removed).`));
}

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .argument('<block>', 'Block ID to remove')
    .description('Remove an installed rule block')
    .action((blockId: string) => runRemove(blockId));
}
