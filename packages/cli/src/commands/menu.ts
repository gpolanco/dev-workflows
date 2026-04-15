import type { Command } from 'commander';
import pc from 'picocolors';
import { runAdd } from './add.js';
import { runRemove } from './remove.js';
import { runDoctor } from './doctor.js';
import { runCompile } from './compile.js';
import { runInit } from './init.js';
import { runWatch } from './watch.js';
import { runList } from './list.js';
import { runExplain } from './explain.js';
import { renderBanner } from '../utils/banner.js';
import { selectPrompt, introPrompt, outroPrompt, notePrompt, isInteractiveSession } from '../utils/prompt.js';
import { resolveContext } from '../core/resolve-context.js';

const MENU_CHOICES = {
  ADD: 'add',
  COMPILE: 'compile',
  WATCH: 'watch',
  REMOVE: 'remove',
  LIST: 'list',
  EXPLAIN: 'explain',
  DOCTOR: 'doctor',
  INIT: 'init',
  EXIT: 'exit',
} as const;

type MenuChoice = (typeof MENU_CHOICES)[keyof typeof MENU_CHOICES];

const LIST_CHOICES = {
  RULES: 'rules',
  TOOLS: 'tools',
  ASSETS: 'assets',
} as const;

type ListChoice = (typeof LIST_CHOICES)[keyof typeof LIST_CHOICES];

export async function runMainMenu(command: Command): Promise<void> {
  if (!isInteractiveSession()) {
    command.help();
    return;
  }

  const banner = renderBanner();
  if (banner.length > 0) {
    console.log(banner);
  }

  let isFirstRun = true;

  while (true) {
    const ctx = await resolveContext(process.cwd());

    if (isFirstRun) {
      if (ctx === null) {
        console.log(`\n  ${pc.dim('○ No configuration found — run Init to get started')}`);
      } else {
        const mode = ctx.globalMode ? 'global mode' : 'local mode';
        const dirLabel = ctx.globalMode ? '~/.dwf/' : '.dwf/';
        introPrompt(`dev-workflows  ·  ${mode}  ·  ${dirLabel}`);
      }
      isFirstRun = false;
    }

    let choice: MenuChoice;

    if (ctx === null) {
      choice = await selectPrompt<MenuChoice>({
        message: 'What do you want to do?',
        options: [
          { label: 'Init project', value: MENU_CHOICES.INIT },
          { label: 'Exit', value: MENU_CHOICES.EXIT },
        ],
      });
    } else {
      choice = await selectPrompt<MenuChoice>({
        message: 'What do you want to do?',
        options: [
          { label: 'Add rules', value: MENU_CHOICES.ADD },
          { label: 'Compile', value: MENU_CHOICES.COMPILE },
          { label: 'Watch', value: MENU_CHOICES.WATCH },
          { label: 'Remove', value: MENU_CHOICES.REMOVE },
          { label: 'List', value: MENU_CHOICES.LIST },
          { label: 'Explain', value: MENU_CHOICES.EXPLAIN },
          { label: 'Check status', value: MENU_CHOICES.DOCTOR },
          { label: 'Exit', value: MENU_CHOICES.EXIT },
        ],
      });
    }

    if (choice === MENU_CHOICES.EXIT) {
      outroPrompt('See you next time.');
      process.exit(0);
    }

    try {
      switch (choice) {
        case MENU_CHOICES.INIT:
          await runInit({});
          isFirstRun = true;
          break;
        case MENU_CHOICES.ADD:
          await runAdd(undefined, {});
          break;
        case MENU_CHOICES.COMPILE:
          await runCompile({ verbose: false, dryRun: false });
          break;
        case MENU_CHOICES.WATCH:
          notePrompt('Press Ctrl+C to stop watching and return to menu', 'Watch mode');
          await runWatch({});
          break;
        case MENU_CHOICES.REMOVE:
          await runRemove(undefined);
          break;
        case MENU_CHOICES.LIST: {
          const listChoice = await selectPrompt<ListChoice>({
            message: 'List what?',
            options: [
              { label: 'Rules', value: LIST_CHOICES.RULES },
              { label: 'Tools', value: LIST_CHOICES.TOOLS },
              { label: 'Assets', value: LIST_CHOICES.ASSETS },
            ],
          });
          await runList(listChoice);
          break;
        }
        case MENU_CHOICES.EXPLAIN:
          await runExplain({});
          break;
        case MENU_CHOICES.DOCTOR:
          await runDoctor();
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n  ${pc.red('✗')} ${message}\n`);
    }
  }
}
