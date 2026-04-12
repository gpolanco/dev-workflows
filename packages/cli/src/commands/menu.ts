import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';
import { runAdd } from './add.js';
import { runRemove } from './remove.js';
import { runDoctor } from './doctor.js';
import { runCompile } from './compile.js';

const menuTheme = {
  style: {
    keysHelpTip: (keys: [string, string][]): string =>
      [...keys, ['Ctrl+C', 'back']]
        .map(([key, action]) => `${chalk.bold(key)} ${chalk.dim(action)}`)
        .join(chalk.dim(' • ')),
  },
} as const;

const MENU_CHOICES = {
  ADD: 'add',
  COMPILE: 'compile',
  DOCTOR: 'doctor',
  REMOVE: 'remove',
  EXIT: 'exit',
} as const;

type MenuChoice = (typeof MENU_CHOICES)[keyof typeof MENU_CHOICES];

export async function runMainMenu(command: Command): Promise<void> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    command.help();
    return;
  }

  while (true) {
    let choice: MenuChoice;
    try {
      choice = await select<MenuChoice>({
        message: 'What do you want to do?',
        theme: menuTheme,
        choices: [
          { name: 'Add rules or assets', value: MENU_CHOICES.ADD },
          { name: 'Compile for all editors', value: MENU_CHOICES.COMPILE },
          { name: 'Check project status', value: MENU_CHOICES.DOCTOR },
          { name: 'Remove something', value: MENU_CHOICES.REMOVE },
          { name: 'Exit', value: MENU_CHOICES.EXIT },
        ],
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        process.exit(0);
      }
      throw err;
    }

    if (choice === MENU_CHOICES.EXIT) {
      process.exit(0);
    }

    try {
      switch (choice) {
        case MENU_CHOICES.ADD:
          await runAdd(undefined, {});
          break;
        case MENU_CHOICES.COMPILE:
          await runCompile({ verbose: false, dryRun: false });
          break;
        case MENU_CHOICES.DOCTOR:
          await runDoctor();
          break;
        case MENU_CHOICES.REMOVE:
          await runRemove(undefined);
          break;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        // Ctrl+C inside a subcommand — return to main menu
      } else {
        throw err;
      }
    }
  }
}
