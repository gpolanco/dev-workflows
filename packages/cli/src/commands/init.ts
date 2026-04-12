import { mkdir, writeFile, readFile, appendFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import type { Command } from 'commander';
import { stringify } from 'yaml';
import { detectTools, SUPPORTED_TOOLS } from '../utils/detect-tools.js';
import * as ui from '../utils/ui.js';
import type { ToolId } from '../utils/detect-tools.js';
import { fileExists } from '../utils/fs.js';
import {
  selectPrompt,
  multiselectPrompt,
  introPrompt,
  outroPrompt,
  spinnerTask,
  isInteractiveSession,
} from '../utils/prompt.js';

export interface InitOptions {
  tools?: string;
  mode?: 'copy' | 'link';
  global?: boolean;
  yes?: boolean;
  preset?: string;
}

import { BUILTIN_SCOPES } from '../core/schema.js';

function buildRuleFileContent(scope: string): string {
  return `# .dwf/rules/${scope}.yml
scope: ${scope}

rules: []
  # Example:
  # - id: my-rule
  #   severity: error
  #   content: |
  #     Describe your rule here.
`;
}

function parseToolsFlag(raw: string): ToolId[] {
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const id of ids) {
    if (!SUPPORTED_TOOLS.includes(id as ToolId)) {
      throw new Error(`Unknown tool "${id}". Supported: ${SUPPORTED_TOOLS.join(', ')}`);
    }
  }
  return ids as ToolId[];
}

async function resolveTools(options: InitOptions, cwd: string): Promise<ToolId[]> {
  const detected = await detectTools(cwd);
  const detectedIds = detected.filter((t) => t.detected).map((t) => t.id);

  if (options.tools) {
    return parseToolsFlag(options.tools);
  }

  if (options.yes) {
    return detectedIds.length > 0 ? detectedIds : ['claude'];
  }

  for (;;) {
    const selected = await multiselectPrompt<ToolId>({
      message: 'Which tools to configure?',
      options: SUPPORTED_TOOLS.map((id) => ({
        label: id,
        value: id,
        hint: detectedIds.includes(id) ? 'detected' : undefined,
      })),
      initialValues: detectedIds,
    });

    if (selected.length > 0) {
      return selected;
    }

    ui.warn('Select at least one tool');
  }
}

async function resolveMode(options: InitOptions): Promise<'copy' | 'link'> {
  if (options.mode) {
    if (options.mode !== 'copy' && options.mode !== 'link') {
      throw new Error(`Unknown mode "${options.mode as string}". Supported: copy, link`);
    }
    return options.mode;
  }

  if (options.yes) {
    return 'copy';
  }

  const mode = await selectPrompt<'copy' | 'link'>({
    message: 'Output mode',
    options: [
      { label: 'copy', value: 'copy' as const, hint: 'Embed rules directly in tool config files' },
      { label: 'link', value: 'link' as const, hint: 'Symlink tool config files to .dwf/ output' },
    ],
  });

  return mode;
}

async function appendToGitignore(cwd: string): Promise<void> {
  const gitignorePath = join(cwd, '.gitignore');
  const entry = '.dwf/.cache/';

  if (await fileExists(gitignorePath)) {
    const content = await readFile(gitignorePath, 'utf-8');
    if (content.includes(entry)) return;
    const suffix = content.endsWith('\n') ? '' : '\n';
    await appendFile(gitignorePath, `${suffix}${entry}\n`);
  } else {
    await writeFile(gitignorePath, `${entry}\n`, 'utf-8');
  }
}

type InitScope = 'project' | 'global';

async function resolveInitScope(options: InitOptions): Promise<InitScope> {
  if (options.global) {
    return 'global';
  }

  if (options.yes) {
    return 'project';
  }

  return selectPrompt<InitScope>({
    message: 'Where do you want to set up devw?',
    options: [
      { label: 'This project (.dwf/)', value: 'project' as const },
      { label: 'Global (~/.dwf/)', value: 'global' as const },
    ],
  });
}

export async function runInit(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  if (isInteractiveSession() && !options.yes) {
    introPrompt('Initialize dev-workflows');
  }

  let scope: InitScope;
  let tools: ToolId[];
  let mode: 'copy' | 'link';
  try {
    scope = await resolveInitScope(options);
    const toolDetectRoot = scope === 'global' ? homedir() : cwd;
    tools = await resolveTools(options, toolDetectRoot);
    mode = await resolveMode(options);
  } catch (err) {
    if (err instanceof Error && err.name === 'ExitPromptError') return;
    ui.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  const rootDir = scope === 'global' ? homedir() : cwd;
  const dwfDir = join(rootDir, '.dwf');

  if (await fileExists(dwfDir)) {
    const locationHint = scope === 'global'
      ? '~/.dwf/ already exists in your home directory'
      : '.dwf/ already exists in this directory';
    ui.error(locationHint, 'Remove it first or run from a different directory');
    process.exitCode = 1;
    return;
  }

  const projectName = scope === 'global' ? 'global' : basename(cwd);

  const rulesDir = join(dwfDir, 'rules');
  await spinnerTask({
    label: 'Creating workspace folders',
    task: async () => {
      await mkdir(rulesDir, { recursive: true });
      await mkdir(join(dwfDir, 'assets'), { recursive: true });
    },
  });

  // Write config.yml
  const config = {
    version: '0.2',
    project: { name: projectName },
    tools,
    mode,
    global: true,
    blocks: [] as string[],
  };
  const configContent = `# Dev Workflows configuration\n${stringify(config)}`;
  await spinnerTask({
    label: 'Writing config.yml',
    task: async () => {
      await writeFile(join(dwfDir, 'config.yml'), configContent, 'utf-8');
    },
  });

  // Write empty rule files
  await spinnerTask({
    label: 'Scaffolding rule files',
    task: async () => {
      for (const scope of BUILTIN_SCOPES) {
        await writeFile(join(rulesDir, `${scope}.yml`), buildRuleFileContent(scope), 'utf-8');
      }
    },
  });

  if (scope !== 'global') {
    await appendToGitignore(cwd);
  }

  // Success summary
  const dwfPath = scope === 'global' ? '~/.dwf/' : '.dwf/';
  ui.newline();
  ui.success(`Initialized ${dwfPath} — ${tools.join(', ')} (${mode} mode)`);
  outroPrompt('Run "devw add" to browse and install rules.');

  if (options.preset) {
    ui.newline();
    ui.info(`Installing preset: ${options.preset}...`);
    const { installPreset } = await import('./add.js');
    const { runCompileFromAdd } = await import('./compile.js');
    const anyAdded = await installPreset(cwd, options.preset, { force: true });
    if (anyAdded) {
      await runCompileFromAdd();
    }
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize .dwf/ in this project or globally')
    .option('--tools <tools>', 'Comma-separated list of tools (claude,cursor,gemini)')
    .option('--mode <mode>', 'Output mode: copy or link')
    .option('--global', 'Initialize global config in ~/.dwf/')
    .option('--preset <preset>', 'Install a preset after initialization (e.g., spec-driven)')
    .option('-y, --yes', 'Accept all defaults')
    .action((options: InitOptions) => runInit(options));
}
