import type { Command } from 'commander';
import { runAdd } from './add.js';
import { runRemove } from './remove.js';
import { runDoctor } from './doctor.js';
import { runCompile } from './compile.js';
import { renderBanner } from '../utils/banner.js';
import { selectPrompt, introPrompt, outroPrompt, isInteractiveSession } from '../utils/prompt.js';

const MENU_CHOICES = {
  ADD: 'add',
  COMPILE: 'compile',
  DOCTOR: 'doctor',
  REMOVE: 'remove',
  EXIT: 'exit',
} as const;

type MenuChoice = (typeof MENU_CHOICES)[keyof typeof MENU_CHOICES];

export async function runMainMenu(command: Command): Promise<void> {
  if (!isInteractiveSession()) {
    command.help();
    return;
  }

  const banner = renderBanner();
  if (banner.length > 0) {
    console.log(banner);
  }
  introPrompt('Welcome to dev-workflows');

  while (true) {
    let choice: MenuChoice;
    choice = await selectPrompt<MenuChoice>({
      message: 'What do you want to do?',
      options: [
        { label: 'Add rules or assets', value: MENU_CHOICES.ADD },
        { label: 'Compile for all editors', value: MENU_CHOICES.COMPILE },
        { label: 'Check project status', value: MENU_CHOICES.DOCTOR },
        { label: 'Remove something', value: MENU_CHOICES.REMOVE },
        { label: 'Exit', value: MENU_CHOICES.EXIT },
      ],
    });

    if (choice === MENU_CHOICES.EXIT) {
      outroPrompt('See you next time.');
      process.exit(0);
    }

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
  }
}
