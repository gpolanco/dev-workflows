import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { Command } from 'commander';
import chalk from 'chalk';
import { stringify, parse } from 'yaml';
import { select, checkbox, confirm } from '@inquirer/prompts';
import { fetchRawContent, listDirectory } from '../utils/github.js';
import { convert } from '../core/converter.js';
import { fileExists } from '../utils/fs.js';
import { readConfig } from '../core/parser.js';
import * as cache from '../utils/cache.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';
import type { PulledEntry } from '../bridges/types.js';

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BACK_VALUE = '__back__';

export function pluralRules(count: number): string {
  return count === 1 ? '1 rule' : `${String(count)} rules`;
}

export interface AddOptions {
  list?: boolean;
  noCompile?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

export function validateInput(input: string): { category: string; name: string } | null {
  const parts = input.split('/');
  if (parts.length !== 2) return null;

  const category = parts[0];
  const name = parts[1];
  if (!category || !name) return null;
  if (!KEBAB_RE.test(category) || !KEBAB_RE.test(name)) return null;

  return { category, name };
}

interface CachedRegistry {
  categories: Array<{
    name: string;
    rules: Array<{ name: string; description: string }>;
  }>;
}

export async function fetchRegistry(cwd: string): Promise<CachedRegistry | null> {
  const cached = await cache.getFromDisk<CachedRegistry>(cwd, 'registry');

  if (cached) return cached;

  ui.info('Fetching available rules from GitHub...');
  ui.newline();

  let topLevel;
  try {
    topLevel = await listDirectory();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Could not fetch rule registry: ${msg}`);
    return null;
  }

  const categories: CachedRegistry['categories'] = [];

  for (const entry of topLevel) {
    if (entry.type !== 'dir') continue;

    try {
      const files = await listDirectory(entry.name);
      const rules: Array<{ name: string; description: string }> = [];

      for (const file of files) {
        if (file.type !== 'file') continue;
        try {
          const content = await fetchRawContent(`${entry.name}/${file.name}`);
          const fmMatch = /^---\n([\s\S]*?)\n---/.exec(content);
          if (fmMatch?.[1]) {
            const fm = parse(fmMatch[1]) as Record<string, unknown>;
            const description = typeof fm['description'] === 'string' ? fm['description'] : '';
            rules.push({ name: file.name, description });
          }
        } catch {
          rules.push({ name: file.name, description: '' });
        }
      }

      if (rules.length > 0) {
        categories.push({ name: entry.name, rules });
      }
    } catch {
      // Skip categories that fail to list
    }
  }

  const registry: CachedRegistry = { categories };
  await cache.set(cwd, 'registry', registry);
  return registry;
}

async function runList(categoryFilter: string | undefined): Promise<void> {
  const cwd = process.cwd();
  const registry = await fetchRegistry(cwd);

  if (!registry) {
    process.exitCode = 1;
    return;
  }

  const displayCategories = categoryFilter
    ? registry.categories.filter((c) => c.name === categoryFilter)
    : registry.categories;

  if (displayCategories.length === 0) {
    if (categoryFilter) {
      ui.warn(`Category "${categoryFilter}" not found`);
    } else {
      ui.warn('No rules available');
    }
    return;
  }

  ui.header('Available rules');
  ui.newline();

  for (const category of displayCategories) {
    console.log(`  ${chalk.cyan(`${category.name}/`)}`);
    for (const rule of category.rules) {
      const desc = rule.description ? chalk.dim(`  ${rule.description}`) : '';
      console.log(`    ${chalk.white(rule.name.padEnd(20))}${desc}`);
    }
    ui.newline();
  }

  console.log(`  ${chalk.dim(`Add a rule:  devw add <category>/<rule>`)}`);
}

export function generateYamlOutput(
  category: string,
  name: string,
  result: ReturnType<typeof convert>,
  pulledAt: string,
): string {
  const source = `${category}/${name}`;
  const githubUrl = `https://github.com/gpolanco/dev-workflows/blob/main/content/rules/${source}.md`;

  const header = [
    `# Pulled from: ${source} (v${result.version})`,
    `# Source: ${githubUrl}`,
    `# Do not edit manually — changes will be overwritten on next pull.`,
    '',
  ].join('\n');

  const doc = {
    source: {
      registry: 'dev-workflows',
      path: source,
      version: result.version,
      pulled_at: pulledAt,
    },
    scope: result.scope,
    rules: result.rules.map((r) => ({
      id: r.id,
      severity: r.severity,
      content: r.content,
      tags: r.tags,
      source: r.source,
    })),
  };

  return header + stringify(doc, { lineWidth: 0 });
}

export async function updateConfig(cwd: string, entry: PulledEntry): Promise<void> {
  const configPath = join(cwd, '.dwf', 'config.yml');
  const raw = await readFile(configPath, 'utf-8');
  const doc = parse(raw) as Record<string, unknown>;

  const pulled = Array.isArray(doc['pulled']) ? (doc['pulled'] as PulledEntry[]) : [];

  const existingIdx = pulled.findIndex((p) => p.path === entry.path);
  if (existingIdx >= 0) {
    pulled[existingIdx] = entry;
  } else {
    pulled.push(entry);
  }

  doc['pulled'] = pulled;
  await writeFile(configPath, stringify(doc, { lineWidth: 0 }), 'utf-8');
}

async function downloadAndInstall(
  cwd: string,
  category: string,
  name: string,
  options: AddOptions,
): Promise<boolean> {
  const source = `${category}/${name}`;
  const fileName = `pulled-${category}-${name}.yml`;
  const filePath = join(cwd, '.dwf', 'rules', fileName);

  ui.info(`Downloading ${source}...`);

  let markdown: string;
  try {
    markdown = await fetchRawContent(source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(msg);
    process.exitCode = 1;
    return false;
  }

  let result: ReturnType<typeof convert>;
  try {
    result = convert(markdown, category, name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Conversion failed: ${msg}`);
    process.exitCode = 1;
    return false;
  }

  if (await fileExists(filePath)) {
    try {
      const existingRaw = await readFile(filePath, 'utf-8');
      const existingDoc = parse(existingRaw) as Record<string, unknown>;
      const existingSource = existingDoc['source'] as Record<string, unknown> | undefined;
      const existingVersion = typeof existingSource?.['version'] === 'string' ? existingSource['version'] : '';

      if (existingVersion === result.version) {
        ui.success(`Already up to date (${source} v${result.version})`);
        return false;
      }

      if (!options.force) {
        ui.newline();
        ui.info(`${source} already exists locally (v${existingVersion} ${ICONS.arrow} v${result.version})`);
        try {
          const shouldOverwrite = await confirm({
            message: 'Overwrite with new version?',
            default: true,
          });
          if (!shouldOverwrite) {
            ui.error('Cancelled');
            return false;
          }
        } catch {
          ui.error('Cancelled');
          return false;
        }
      }
    } catch {
      // Can't parse existing file — overwrite
    }
  }

  const pulledAt = new Date().toISOString();
  const yamlOutput = generateYamlOutput(category, name, result, pulledAt);

  if (options.dryRun) {
    ui.newline();
    ui.header('Dry run — would write:');
    ui.newline();
    console.log(chalk.dim(`  ${fileName}`));
    ui.newline();
    console.log(yamlOutput);
    return false;
  }

  await mkdir(join(cwd, '.dwf', 'rules'), { recursive: true });
  await writeFile(filePath, yamlOutput, 'utf-8');

  const entry: PulledEntry = {
    path: source,
    version: result.version,
    pulled_at: pulledAt,
  };
  await updateConfig(cwd, entry);

  ui.success(`Added ${source} (${pluralRules(result.rules.length)})`);
  return true;
}

async function runInteractive(cwd: string, options: AddOptions): Promise<void> {
  const registry = await fetchRegistry(cwd);
  if (!registry) {
    process.exitCode = 1;
    return;
  }

  if (registry.categories.length === 0) {
    ui.warn('No rules available');
    return;
  }

  let installedPaths: Set<string>;
  try {
    const config = await readConfig(cwd);
    installedPaths = new Set(config.pulled.map((p) => p.path));
  } catch {
    installedPaths = new Set();
  }

  const allSelected: Array<{ category: string; name: string; description: string }> = [];
  const processedCategories = new Set<string>();

  try {
    for (;;) {
      const availableCategories = registry.categories.filter(
        (c) => !processedCategories.has(c.name),
      );
      if (availableCategories.length === 0) break;

      const selectedCategoryName = await select<string>({
        message: 'Choose a category',
        choices: availableCategories.map((c) => {
          const allInstalled = c.rules.every((r) =>
            installedPaths.has(`${c.name}/${r.name}`),
          );
          const label = `${c.name} (${pluralRules(c.rules.length)})`;
          return {
            name: allInstalled ? `${label} ${chalk.dim('(all installed)')}` : label,
            value: c.name,
          };
        }),
      });

      const category = registry.categories.find((c) => c.name === selectedCategoryName);
      if (!category) break;

      const selected = await checkbox<string>({
        message: 'Select rules to add',
        choices: [
          { name: '\u2190 Back to categories', value: BACK_VALUE },
          ...category.rules.map((r) => {
            const path = `${category.name}/${r.name}`;
            const installed = installedPaths.has(path);
            const desc = r.description ? ` ${ICONS.dash} ${r.description}` : '';
            const suffix = installed ? chalk.dim(' (already installed)') : '';
            return {
              name: `${r.name}${desc}${suffix}`,
              value: r.name,
            };
          }),
        ],
      });

      const realRules = selected.filter((v) => v !== BACK_VALUE);

      if (realRules.length === 0) {
        if (selected.includes(BACK_VALUE)) continue;
        ui.warn('No rules selected');
        continue;
      }

      for (const ruleName of realRules) {
        const ruleInfo = category.rules.find((r) => r.name === ruleName);
        allSelected.push({
          category: category.name,
          name: ruleName,
          description: ruleInfo?.description ?? '',
        });
      }
      processedCategories.add(category.name);

      const remaining = registry.categories.filter(
        (c) => !processedCategories.has(c.name),
      );
      if (remaining.length === 0) break;

      const addMore = await confirm({
        message: 'Add rules from another category?',
        default: true,
      });
      if (!addMore) break;
    }
  } catch {
    ui.error('Cancelled');
    return;
  }

  if (allSelected.length === 0) return;

  ui.newline();
  ui.header('Rules to install:');
  for (const rule of allSelected) {
    const desc = rule.description ? chalk.dim(` ${ICONS.dash} ${rule.description}`) : '';
    console.log(`    ${rule.category}/${rule.name}${desc}`);
  }
  ui.newline();

  try {
    const shouldProceed = await confirm({
      message: `Install ${pluralRules(allSelected.length)}?`,
      default: true,
    });
    if (!shouldProceed) {
      ui.error('Cancelled');
      return;
    }
  } catch {
    ui.error('Cancelled');
    return;
  }

  let anyAdded = false;
  for (const rule of allSelected) {
    const added = await downloadAndInstall(cwd, rule.category, rule.name, options);
    if (added) anyAdded = true;
  }

  if (anyAdded && !options.noCompile) {
    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
  }
}

async function runAdd(ruleArg: string | undefined, options: AddOptions): Promise<void> {
  if (options.list) {
    await runList(ruleArg);
    return;
  }

  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  if (!ruleArg) {
    if (!process.stdout.isTTY || !process.stdin.isTTY) {
      ui.error('No rule specified', 'Usage: devw add <category>/<rule>');
      process.exitCode = 1;
      return;
    }

    await runInteractive(cwd, options);
    return;
  }

  if (!ruleArg.includes('/')) {
    ui.error('Block format is no longer supported', 'Use: devw add <category>/<rule>. Run devw add --list to browse.');
    process.exitCode = 1;
    return;
  }

  const parsed = validateInput(ruleArg);
  if (!parsed) {
    ui.error(
      `Invalid rule path "${ruleArg}"`,
      'Format: <category>/<rule> — both must be kebab-case (e.g., typescript/strict)',
    );
    process.exitCode = 1;
    return;
  }

  const { category, name } = parsed;
  const added = await downloadAndInstall(cwd, category, name, options);

  if (added && !options.noCompile) {
    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
  }
}

export function registerAddCommand(program: Command): void {
  program
    .command('add')
    .argument('[rule]', 'Rule path: <category>/<rule>')
    .description('Add rules from the dev-workflows registry')
    .option('--list', 'List available rules')
    .option('--no-compile', 'Skip auto-compile after adding')
    .option('--force', 'Overwrite without asking')
    .option('--dry-run', 'Show output without writing files')
    .action((rule: string | undefined, options: AddOptions) => runAdd(rule, options));
}
