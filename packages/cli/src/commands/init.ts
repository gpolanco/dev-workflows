import { mkdir, writeFile, readFile, appendFile, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { Command } from 'commander';
import { stringify } from 'yaml';
import chalk from 'chalk';
import { detectTools, SUPPORTED_TOOLS } from '../utils/detect-tools.js';
import type { ToolId } from '../utils/detect-tools.js';
import { ask } from '../utils/prompt.js';

export interface InitOptions {
  tools?: string;
  mode?: 'copy' | 'link';
  yes?: boolean;
}

const RULE_SCOPES = ['architecture', 'conventions', 'security', 'workflow', 'testing'] as const;

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

  const defaultTools = detectedIds.length > 0 ? detectedIds.join(',') : 'claude';
  if (detectedIds.length > 0) {
    console.log(`Detected tools: ${chalk.cyan(detectedIds.join(', '))}`);
  }
  for (;;) {
    const answer = await ask(
      `Which tools to configure? (${SUPPORTED_TOOLS.join(',')}) [${defaultTools}]: `,
      defaultTools,
    );
    try {
      return parseToolsFlag(answer);
    } catch {
      console.log(chalk.yellow(`Invalid selection. Supported tools: ${SUPPORTED_TOOLS.join(', ')}`));
    }
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

  for (;;) {
    const answer = await ask('Output mode — copy or link? [copy]: ', 'copy');
    if (answer === 'copy' || answer === 'link') {
      return answer;
    }
    console.log(chalk.yellow(`Unknown mode "${answer}". Please enter copy or link.`));
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
    console.error(chalk.red('Error: .dwf/ already exists in this directory.'));
    console.error('Remove it first or run from a different directory.');
    process.exitCode = 1;
    return;
  }

  let tools: ToolId[];
  let mode: 'copy' | 'link';
  try {
    tools = await resolveTools(options, cwd);
    mode = await resolveMode(options);
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
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
  for (const scope of RULE_SCOPES) {
    await writeFile(join(rulesDir, `${scope}.yml`), buildRuleFileContent(scope), 'utf-8');
  }

  // Append .dwf/.cache/ to .gitignore
  await appendToGitignore(cwd);

  // Success summary
  console.log('');
  console.log(chalk.green('Initialized .dwf/ successfully!'));
  console.log('');
  console.log(`  Project:  ${chalk.bold(projectName)}`);
  console.log(`  Tools:    ${chalk.cyan(tools.join(', '))}`);
  console.log(`  Mode:     ${mode}`);
  console.log('');
  console.log('  Created files:');
  console.log(`    ${chalk.dim('.dwf/config.yml')}`);
  for (const scope of RULE_SCOPES) {
    console.log(`    ${chalk.dim(`.dwf/rules/${scope}.yml`)}`);
  }
  console.log(`    ${chalk.dim('.gitignore')} (added .dwf/.cache/)`);
  console.log('');
  console.log(`Next: edit ${chalk.cyan('.dwf/rules/')} and run ${chalk.cyan('devw compile')}`);
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
