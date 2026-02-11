import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { Command } from 'commander';
import chalk from 'chalk';
import { stringify, parse } from 'yaml';
import { confirm } from '@inquirer/prompts';
import { fetchRawContent, listDirectory } from '../utils/github.js';
import { convert } from '../core/converter.js';
import { fileExists } from '../utils/fs.js';
import * as cache from '../utils/cache.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';
import type { PulledEntry } from '../bridges/types.js';

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PullOptions {
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

async function runList(categoryFilter: string | undefined): Promise<void> {
  const cwd = process.cwd();

  // Try cache first
  const cached = await cache.getFromDisk<CachedRegistry>(cwd, 'registry');

  let registry: CachedRegistry;

  if (cached) {
    registry = cached;
  } else {
    ui.info('Fetching available rules from GitHub...');
    ui.newline();

    let topLevel;
    try {
      topLevel = await listDirectory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ui.error(`Could not fetch rule registry: ${msg}`);
      process.exitCode = 1;
      return;
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

    registry = { categories };
    await cache.set(cwd, 'registry', registry);
  }

  // Filter if category specified
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

  console.log(`  ${chalk.dim(`Pull a rule:  devw pull <category>/<rule>`)}`);
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

async function runPull(ruleArg: string | undefined, options: PullOptions): Promise<void> {
  if (options.list) {
    await runList(ruleArg);
    return;
  }

  if (!ruleArg) {
    ui.error('Specify a rule to pull', 'Usage: devw pull <category>/<rule>');
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();

  // Validate .dwf/ exists
  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  // Validate input format
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
  const source = `${category}/${name}`;
  const fileName = `pulled-${category}-${name}.yml`;
  const filePath = join(cwd, '.dwf', 'rules', fileName);

  // Download markdown
  ui.info(`Downloading ${source}...`);

  let markdown: string;
  try {
    markdown = await fetchRawContent(source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(msg);
    process.exitCode = 1;
    return;
  }

  // Convert
  let result: ReturnType<typeof convert>;
  try {
    result = convert(markdown, category, name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Conversion failed: ${msg}`);
    process.exitCode = 1;
    return;
  }

  // Check existing file
  if (await fileExists(filePath)) {
    try {
      const existingRaw = await readFile(filePath, 'utf-8');
      const existingDoc = parse(existingRaw) as Record<string, unknown>;
      const existingSource = existingDoc['source'] as Record<string, unknown> | undefined;
      const existingVersion = typeof existingSource?.['version'] === 'string' ? existingSource['version'] : '';

      if (existingVersion === result.version) {
        ui.success(`Already up to date (${source} v${result.version})`);
        return;
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
            ui.info('Pull cancelled');
            return;
          }
        } catch {
          ui.info('Pull cancelled');
          return;
        }
      }
    } catch {
      // Can't parse existing file — overwrite
    }
  }

  const pulledAt = new Date().toISOString();
  const yamlOutput = generateYamlOutput(category, name, result, pulledAt);

  // Dry run
  if (options.dryRun) {
    ui.newline();
    ui.header('Dry run — would write:');
    ui.newline();
    console.log(chalk.dim(`  ${fileName}`));
    ui.newline();
    console.log(yamlOutput);
    return;
  }

  // Write file
  await mkdir(join(cwd, '.dwf', 'rules'), { recursive: true });
  await writeFile(filePath, yamlOutput, 'utf-8');

  // Update config
  const entry: PulledEntry = {
    path: source,
    version: result.version,
    pulled_at: pulledAt,
  };
  await updateConfig(cwd, entry);

  ui.success(`Pulled ${source} (${String(result.rules.length)} rules)`);

  // Auto-compile
  if (!options.noCompile) {
    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
  }
}

export function registerPullCommand(program: Command): void {
  program
    .command('pull')
    .argument('[rule]', 'Rule path: <category>/<rule> (e.g., typescript/strict)')
    .description('Pull rules from the official dev-workflows registry')
    .option('--list', 'List available rules')
    .option('--no-compile', 'Skip auto-compile after pull')
    .option('--force', 'Overwrite without asking')
    .option('--dry-run', 'Show output without writing files')
    .action((rule: string | undefined, options: PullOptions) => runPull(rule, options));
}
