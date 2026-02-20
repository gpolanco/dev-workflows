import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { executePipeline } from './compile.js';
import type { CompileResult } from './compile.js';
import { fileExists } from '../utils/fs.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';

interface WatchOptions {
  tool?: string;
}

const DEBOUNCE_MS = 200;

function printCompileResult(result: CompileResult): void {
  for (const br of result.results) {
    if (br.success) {
      ui.success(`${br.bridgeId.padEnd(10)} ${ICONS.arrow} ${br.outputPath}`);
    } else {
      ui.error(`${br.bridgeId.padEnd(10)} ${ICONS.arrow} ${br.error ?? 'failed to write output'}`);
    }
  }
  ui.info(`Done in ${String(Math.round(result.elapsedMs))}ms`);
}

function printWaiting(withHint = false): void {
  ui.newline();
  if (withHint) {
    ui.info('Waiting for changes... (Ctrl+C to stop)');
  } else {
    ui.info('Waiting for changes...');
  }
}

async function runWatch(options: WatchOptions): Promise<void> {
  const cwd = process.cwd();
  const dwfDir = join(cwd, '.dwf');

  if (!(await fileExists(join(dwfDir, 'config.yml')))) {
    ui.error('.dwf/ not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  const watcher = chokidar.watch(['**/*.yml', '**/*.yaml', 'assets/**/*.md', 'assets/**/*.json'], {
    cwd: dwfDir,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  await new Promise<void>((resolve) => {
    watcher.on('ready', () => resolve());
  });

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let lastChangedPath = '';

  const runCompileOnChange = async (): Promise<void> => {
    ui.newline();
    ui.header(`${ICONS.reload} Change detected: .dwf/${lastChangedPath}`);
    ui.info('Compiling...');
    ui.newline();

    try {
      const result = await executePipeline({ cwd, tool: options.tool });
      printCompileResult(result);

      const hasFailures = result.results.some((r) => !r.success);
      if (hasFailures) {
        ui.newline();
        ui.info('Watch mode continues running.');
      }

      printWaiting();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ui.error(message);
      ui.info('Watch mode is still running. Fix the error and save again.');
    }
  };

  watcher.on('all', (_event: string, filePath: string) => {
    lastChangedPath = filePath;

    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      void runCompileOnChange();
    }, DEBOUNCE_MS);
  });

  process.on('SIGINT', () => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    void watcher.close();
    process.exit(0);
  });

  ui.newline();
  ui.header(chalk.green('Watching .dwf/ for changes...'));
  ui.info('Running initial compile...');
  ui.newline();

  try {
    const result = await executePipeline({ cwd, tool: options.tool });
    printCompileResult(result);
    printWaiting(true);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ui.error(message);
    ui.info('Watch mode is still running. Fix the error and save again.');
  }
}

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch .dwf/ for changes and recompile automatically')
    .option('--tool <tool>', 'Recompile only a specific bridge (claude, cursor, gemini, windsurf, copilot)')
    .action((options: WatchOptions) => runWatch(options));
}
