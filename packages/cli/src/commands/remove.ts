import { join } from 'node:path';
import type { Command } from 'commander';
import { select } from '@inquirer/prompts';
import { readConfig } from '../core/parser.js';
import { uninstallBlock } from '../blocks/installer.js';
import { fileExists } from '../utils/fs.js';
import * as ui from '../utils/ui.js';

function ensureConfig(cwd: string): Promise<boolean> {
  return fileExists(join(cwd, '.dwf', 'config.yml'));
}

async function selectBlock(blocks: string[]): Promise<string> {
  return select<string>({
    message: 'Which block to remove?',
    choices: blocks.map((id) => ({ name: id, value: id })),
  });
}

async function runRemove(blockId?: string): Promise<void> {
  const cwd = process.cwd();

  if (!(await ensureConfig(cwd))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);

  if (!blockId) {
    if (config.blocks.length === 0) {
      ui.warn('No blocks installed');
      return;
    }
    blockId = await selectBlock(config.blocks);
  }

  if (!config.blocks.includes(blockId)) {
    ui.error(`Block "${blockId}" is not installed`, `Installed blocks: ${config.blocks.length > 0 ? config.blocks.join(', ') : '(none)'}`);
    process.exitCode = 1;
    return;
  }

  const rulesRemoved = await uninstallBlock(cwd, blockId);
  ui.success(`Removed ${blockId} (${String(rulesRemoved)} rules)`);
}

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .argument('[block]', 'Block ID to remove')
    .description('Remove an installed rule block')
    .action((blockId?: string) => runRemove(blockId));
}
