import { join } from 'node:path';
import type { Command } from 'commander';
import { readConfig } from '../core/parser.js';
import { uninstallBlock } from '../blocks/installer.js';
import { fileExists } from '../utils/fs.js';
import * as ui from '../utils/ui.js';

async function runRemove(blockId: string): Promise<void> {
  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);
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
    .argument('<block>', 'Block ID to remove')
    .description('Remove an installed rule block')
    .action((blockId: string) => runRemove(blockId));
}
