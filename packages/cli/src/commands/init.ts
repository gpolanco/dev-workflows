import { mkdir, writeFile, readFile, appendFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import type { Command } from 'commander';
import { stringify } from 'yaml';
import chalk from 'chalk';
import { checkbox, select } from '@inquirer/prompts';
import { detectTools, SUPPORTED_TOOLS } from '../utils/detect-tools.js';
import * as ui from '../utils/ui.js';
import type { ToolId } from '../utils/detect-tools.js';
import { fileExists } from '../utils/fs.js';

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
    const selected = await checkbox<ToolId>({
      message: 'Which tools to configure?',
      choices: SUPPORTED_TOOLS.map((id) => ({
        name: id,
        value: id,
        checked: detectedIds.includes(id),
      })),
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

  const mode = await select<'copy' | 'link'>({
    message: 'Output mode',
    choices: [
      { name: 'copy', value: 'copy' as const, description: 'Embed rules directly in tool config files' },
      { name: 'link', value: 'link' as const, description: 'Symlink tool config files to .dwf/ output' },
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

  return select<InitScope>({
    message: 'Where do you want to set up devw?',
    choices: [
      { name: 'This project (.dwf/)', value: 'project' as const },
      { name: 'Global (~/.dwf/)', value: 'global' as const },
    ],
  });
}

export async function runInit(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

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

  // Create .dwf/rules/ and .dwf/assets/
  const rulesDir = join(dwfDir, 'rules');
  await mkdir(rulesDir, { recursive: true });
  await mkdir(join(dwfDir, 'assets'), { recursive: true });

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
  await writeFile(join(dwfDir, 'config.yml'), configContent, 'utf-8');

  // Write empty rule files
  for (const scope of BUILTIN_SCOPES) {
    await writeFile(join(rulesDir, `${scope}.yml`), buildRuleFileContent(scope), 'utf-8');
  }

  // Ensure canonical global output dir exists for global mode.
  if (scope === 'global') {
    await mkdir(join(rootDir, '.agents', 'rules', 'devw'), { recursive: true });
  } else {
    // Append .dwf/.cache/ to .gitignore for project mode.
    await appendToGitignore(cwd);
  }

  // Success summary
  ui.newline();
  ui.header('dev-workflows');
  ui.newline();
  ui.success(`Initialized ${scope === 'global' ? '~/.dwf/' : '.dwf/'} successfully`);
  ui.newline();
  ui.keyValue('Project:', chalk.bold(projectName));
  ui.keyValue('Scope:', scope);
  ui.keyValue('Tools:', chalk.cyan(tools.join(', ')));
  ui.keyValue('Mode:', mode);
  ui.newline();
  ui.header("What's next");
  ui.newline();
  console.log(`    1. Browse available rules         ${chalk.cyan('devw add --list')}`);
  console.log(`    2. Add a rule                     ${chalk.cyan('devw add <category>/<rule>')}`);
  console.log(`    3. Or write your own rules in     ${chalk.cyan(scope === 'global' ? '~/.dwf/rules/' : '.dwf/rules/')}`);
  console.log(`    4. When ready, compile            ${chalk.cyan('devw compile')}`);

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
