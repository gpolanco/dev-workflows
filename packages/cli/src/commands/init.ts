import { mkdir, writeFile, readFile, appendFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
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
  yes?: boolean;
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

async function runInit(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const dwfDir = join(cwd, '.dwf');

  if (await fileExists(dwfDir)) {
    ui.error('.dwf/ already exists in this directory', 'Remove it first or run from a different directory');
    process.exitCode = 1;
    return;
  }

  let tools: ToolId[];
  let mode: 'copy' | 'link';
  try {
    tools = await resolveTools(options, cwd);
    mode = await resolveMode(options);
  } catch (err) {
    if (err instanceof Error && err.name === 'ExitPromptError') return;
    ui.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  const projectName = basename(cwd);

  // Create .dwf/rules/
  const rulesDir = join(dwfDir, 'rules');
  await mkdir(rulesDir, { recursive: true });

  // Write config.yml
  const config = {
    version: '0.1',
    project: { name: projectName },
    tools,
    mode,
    blocks: [] as string[],
  };
  const configContent = `# Dev Workflows configuration\n${stringify(config)}`;
  await writeFile(join(dwfDir, 'config.yml'), configContent, 'utf-8');

  // Write empty rule files
  for (const scope of BUILTIN_SCOPES) {
    await writeFile(join(rulesDir, `${scope}.yml`), buildRuleFileContent(scope), 'utf-8');
  }

  // Append .dwf/.cache/ to .gitignore
  await appendToGitignore(cwd);

  // Success summary
  ui.newline();
  ui.header('dev-workflows');
  ui.newline();
  ui.success('Initialized .dwf/ successfully');
  ui.newline();
  ui.keyValue('Project:', chalk.bold(projectName));
  ui.keyValue('Tools:', chalk.cyan(tools.join(', ')));
  ui.keyValue('Mode:', mode);
  ui.newline();
  ui.header("What's next");
  ui.newline();
  console.log(`    1. Browse available rule blocks   ${chalk.cyan('devw add --list')}`);
  console.log(`    2. Install a block                ${chalk.cyan('devw add typescript-strict')}`);
  console.log(`    3. Or write your own rules in     ${chalk.cyan('.dwf/rules/')}`);
  console.log(`    4. When ready, compile            ${chalk.cyan('devw compile')}`);
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize .dwf/ in the current project')
    .option('--tools <tools>', 'Comma-separated list of tools (claude,cursor,gemini)')
    .option('--mode <mode>', 'Output mode: copy or link')
    .option('-y, --yes', 'Accept all defaults')
    .action((options: InitOptions) => runInit(options));
}
