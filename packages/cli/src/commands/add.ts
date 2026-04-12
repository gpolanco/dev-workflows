import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { Command } from 'commander';
import pc from 'picocolors';
import { stringify, parse } from 'yaml';
import { fetchRawContent, fetchContent, listDirectory, listContentDirectory } from '../utils/github.js';
import { convert } from '../core/converter.js';
import { isAssetType, parseAssetFrontmatter } from '../core/assets.js';
import { fileExists } from '../utils/fs.js';
import { readConfig } from '../core/parser.js';
import {
  selectPrompt,
  multiselectPrompt,
  confirmPrompt,
  introPrompt,
  outroPrompt,
  spinnerTask,
  isInteractiveSession,
} from '../utils/prompt.js';
import * as cache from '../utils/cache.js';
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';
import type { PulledEntry, AssetEntry, AssetType } from '../bridges/types.js';

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
    topLevel = await spinnerTask({
      label: 'Fetching rule categories',
      task: async () => listDirectory(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Could not fetch rule registry: ${msg}`);
    return null;
  }

  const dirs = topLevel.filter((e) => e.type === 'dir');

  const categoryResults = await Promise.all(
    dirs.map(async (entry) => {
      try {
        const files = await listDirectory(entry.name);
        const ruleFiles = files.filter((f) => f.type === 'file');

        const rules = await Promise.all(
          ruleFiles.map(async (file) => {
            try {
              const content = await fetchRawContent(`${entry.name}/${file.name}`);
              const fmMatch = /^---\n([\s\S]*?)\n---/.exec(content);
              if (fmMatch?.[1]) {
                const fm = parse(fmMatch[1]) as Record<string, unknown>;
                const description = typeof fm['description'] === 'string' ? fm['description'] : '';
                return { name: file.name, description };
              }
              return { name: file.name, description: '' };
            } catch {
              return { name: file.name, description: '' };
            }
          }),
        );

        return rules.length > 0 ? { name: entry.name, rules } : null;
      } catch {
        return null;
      }
    }),
  );

  const categories = categoryResults.filter((c): c is NonNullable<typeof c> => c !== null);
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
    console.log(`  ${pc.cyan(`${category.name}/`)}`);
    for (const rule of category.rules) {
      const desc = rule.description ? pc.dim(`  ${rule.description}`) : '';
      console.log(`    ${pc.white(rule.name.padEnd(20))}${desc}`);
    }
    ui.newline();
  }

  console.log(`  ${pc.dim(`Add a rule:  devw add <category>/<rule>`)}`);

  // Show available assets if not filtering by category
  if (!categoryFilter) {
    const assetTypes = ['commands', 'templates', 'hooks', 'presets'] as const;
    const assetResults = await Promise.allSettled(
      assetTypes.map((dir) => listContentDirectory(dir)),
    );

    const hasAnyAssets = assetResults.some(
      (r) => r.status === 'fulfilled' && r.value.some((e) => e.type === 'file'),
    );

    if (hasAnyAssets) {
      ui.newline();
      ui.header('Available assets');
      ui.newline();
      for (let i = 0; i < assetTypes.length; i++) {
        const type = assetTypes[i]!;
        const result = assetResults[i]!;
        if (result.status !== 'fulfilled') continue;
        const names = result.value.filter((e) => e.type === 'file').map((e) => e.name);
        if (names.length === 0) continue;
        const singular = type.replace(/s$/, '');
        console.log(`  ${pc.cyan(`${singular}/`)}`);
        for (const name of names) {
          console.log(`    ${pc.white(name)}`);
        }
        ui.newline();
      }
      console.log(`  ${pc.dim(`Add an asset: devw add command/<name>`)}`);
    }
  }
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

export async function updateConfigAssets(cwd: string, entry: AssetEntry): Promise<void> {
  const configPath = join(cwd, '.dwf', 'config.yml');
  const raw = await readFile(configPath, 'utf-8');
  const doc = parse(raw) as Record<string, unknown>;

  const assets = Array.isArray(doc['assets']) ? (doc['assets'] as AssetEntry[]) : [];

  const existingIdx = assets.findIndex((a) => a.type === entry.type && a.name === entry.name);
  if (existingIdx >= 0) {
    assets[existingIdx] = entry;
  } else {
    assets.push(entry);
  }

  doc['assets'] = assets;
  await writeFile(configPath, stringify(doc, { lineWidth: 0 }), 'utf-8');
}

function getAssetContentPath(type: AssetType, name: string): string {
  const ext = type === 'hook' ? 'json' : 'md';
  return `${type}s/${name}.${ext}`;
}

export async function downloadAndInstallAsset(
  cwd: string,
  type: AssetType,
  name: string,
  options: AddOptions,
): Promise<boolean> {
  const source = `${type}/${name}`;
  const ext = type === 'hook' ? 'json' : 'md';
  const fileName = `${name}.${ext}`;
  const assetDir = join(cwd, '.dwf', 'assets', `${type}s`);
  const filePath = join(assetDir, fileName);

  ui.info(`Downloading ${source}...`);

  let content: string;
  try {
    content = await spinnerTask({
      label: `Fetching ${source}`,
      task: async () => fetchContent(getAssetContentPath(type, name)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(msg);
    process.exitCode = 1;
    return false;
  }

  let version = '0.1.0';
  if (type === 'hook') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (typeof parsed['version'] === 'string') version = parsed['version'];
    } catch {
      // Use default version
    }
  } else {
    const { frontmatter } = parseAssetFrontmatter(content);
    version = frontmatter.version;
  }

  if (await fileExists(filePath)) {
    if (!options.force) {
      ui.info(`${source} already exists locally`);
      try {
        const shouldOverwrite = await confirmPrompt({
          message: 'Overwrite?',
          defaultValue: true,
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
  }

  if (options.dryRun) {
    ui.newline();
    ui.header('Dry run — would write:');
    ui.newline();
    console.log(pc.dim(`  .dwf/assets/${type}s/${fileName}`));
    return false;
  }

  await mkdir(assetDir, { recursive: true });
  await writeFile(filePath, content, 'utf-8');

  const entry: AssetEntry = {
    type,
    name,
    version,
    installed_at: new Date().toISOString(),
  };
  await updateConfigAssets(cwd, entry);

  ui.success(`Added ${source} (v${version})`);
  return true;
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
    markdown = await spinnerTask({
      label: `Fetching ${source}`,
      task: async () => fetchRawContent(source),
    });
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
           const shouldOverwrite = await confirmPrompt({
             message: 'Overwrite with new version?',
             defaultValue: true,
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
    console.log(pc.dim(`  ${fileName}`));
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

async function runInteractiveAsset(cwd: string, options: AddOptions): Promise<void> {
  introPrompt('Add assets');
  let assetType: AssetType | 'preset';
  try {
    assetType = await selectPrompt<AssetType | 'preset'>({
      message: 'Asset type',
      options: [
        { label: 'command  — Slash commands for Claude Code', value: 'command' },
        { label: 'template — Spec and document templates', value: 'template' },
        { label: 'hook     — Editor hooks (auto-format, etc.)', value: 'hook' },
        { label: 'preset   — Bundle of rules + assets', value: 'preset' },
      ],
    });
  } catch {
    ui.error('Cancelled');
    return;
  }

  ui.info(`Fetching available ${assetType}s from GitHub...`);

  let names: string[];
  try {
    const entries = await listContentDirectory(`${assetType}s`);
    names = entries.filter((e) => e.type === 'file').map((e) => e.name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Could not fetch ${assetType} list: ${msg}`);
    process.exitCode = 1;
    return;
  }

  if (names.length === 0) {
    ui.warn(`No ${assetType}s available in registry`);
    return;
  }

  let selected: string[];
  try {
    selected = await multiselectPrompt<string>({
      message: `Select ${assetType}s to install`,
      options: names.map((name) => ({ label: name, value: name })),
    });
  } catch {
    ui.error('Cancelled');
    return;
  }

  if (selected.length === 0) {
    ui.warn('No assets selected');
    return;
  }

  let anyAdded = false;
  for (const name of selected) {
    if (assetType === 'preset') {
      const added = await installPreset(cwd, name, options);
      if (added) anyAdded = true;
    } else {
      const added = await downloadAndInstallAsset(cwd, assetType, name, options);
      if (added) anyAdded = true;
    }
  }

  if (anyAdded && !options.noCompile) {
    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
  }

  outroPrompt('Asset flow completed');
}

async function runInteractive(cwd: string, options: AddOptions): Promise<void> {
  introPrompt('Add rules or assets');
  let mode: 'rules' | 'assets';
  try {
    mode = await selectPrompt<'rules' | 'assets'>({
      message: 'What do you want to add?',
      options: [
        { label: 'Rules    — Install rules from the registry', value: 'rules' },
        { label: 'Assets   — Commands, templates, hooks, presets', value: 'assets' },
      ],
    });
  } catch {
    ui.error('Cancelled');
    return;
  }

  if (mode === 'assets') {
    await runInteractiveAsset(cwd, options);
    return;
  }

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

      const selectedCategoryName = await selectPrompt<string>({
        message: 'Choose a category',
        options: availableCategories.map((c) => {
          const allInstalled = c.rules.every((r) =>
            installedPaths.has(`${c.name}/${r.name}`),
          );
          const label = `${c.name} (${pluralRules(c.rules.length)})`;
          return {
            label: allInstalled ? `${label} ${pc.dim('(all installed)')}` : label,
            value: c.name,
          };
        }),
      });

      const category = registry.categories.find((c) => c.name === selectedCategoryName);
      if (!category) break;

      const selected = await multiselectPrompt<string>({
        message: 'Select rules to add',
        options: [
          { label: '\u2190 Back to categories', value: BACK_VALUE },
          ...category.rules.map((r) => {
            const path = `${category.name}/${r.name}`;
            const installed = installedPaths.has(path);
            const desc = r.description ? ` ${ICONS.dash} ${r.description}` : '';
            const suffix = installed ? pc.dim(' (already installed)') : '';
            return {
              label: `${r.name}${desc}${suffix}`,
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

      const addMore = await confirmPrompt({
        message: 'Add rules from another category?',
        defaultValue: true,
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
    const desc = rule.description ? pc.dim(` ${ICONS.dash} ${rule.description}`) : '';
    console.log(`    ${rule.category}/${rule.name}${desc}`);
  }
  ui.newline();

  try {
    const shouldProceed = await confirmPrompt({
      message: `Install ${pluralRules(allSelected.length)}?`,
      defaultValue: true,
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

  outroPrompt('Add flow completed');
}

interface PresetManifest {
  name: string;
  description: string;
  version: string;
  includes: {
    rules?: string[];
    commands?: string[];
    templates?: string[];
    hooks?: string[];
  };
}

export async function installPreset(
  cwd: string,
  presetName: string,
  options: AddOptions,
): Promise<boolean> {
  ui.info(`Downloading preset ${presetName}...`);

  let content: string;
  try {
    content = await fetchContent(`presets/${presetName}.yml`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Preset not found: ${msg}`);
    process.exitCode = 1;
    return false;
  }

  let manifest: PresetManifest;
  try {
    manifest = parse(content) as PresetManifest;
  } catch {
    ui.error(`Invalid preset YAML: ${presetName}`);
    process.exitCode = 1;
    return false;
  }

  ui.newline();
  ui.header(`Preset: ${manifest.name}`);
  if (manifest.description) {
    ui.info(manifest.description);
  }
  ui.newline();

  const noCompileOptions: AddOptions = { ...options, noCompile: true };
  let anyAdded = false;

  const rules = manifest.includes.rules ?? [];
  for (const rule of rules) {
    const added = await downloadAndInstall(cwd, rule.split('/')[0] ?? '', rule.split('/')[1] ?? rule, noCompileOptions);
    if (added) anyAdded = true;
  }

  const commands = manifest.includes.commands ?? [];
  for (const cmd of commands) {
    const added = await downloadAndInstallAsset(cwd, 'command', cmd, noCompileOptions);
    if (added) anyAdded = true;
  }

  const templates = manifest.includes.templates ?? [];
  for (const tmpl of templates) {
    const added = await downloadAndInstallAsset(cwd, 'template', tmpl, noCompileOptions);
    if (added) anyAdded = true;
  }

  const hooks = manifest.includes.hooks ?? [];
  for (const hook of hooks) {
    const added = await downloadAndInstallAsset(cwd, 'hook', hook, noCompileOptions);
    if (added) anyAdded = true;
  }

  return anyAdded;
}

export async function runAdd(ruleArg: string | undefined, options: AddOptions): Promise<void> {
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
    if (!isInteractiveSession()) {
      ui.error('No rule specified', 'Usage: devw add <category>/<rule>');
      process.exitCode = 1;
      return;
    }

    await runInteractive(cwd, options);
    return;
  }

  if (isInteractiveSession()) {
    introPrompt('Adding item');
  }

  if (!ruleArg.includes('/')) {
    const dashIdx = ruleArg.indexOf('-');
    const hint =
      dashIdx > 0
        ? `devw add ${ruleArg.slice(0, dashIdx)}/${ruleArg.slice(dashIdx + 1)}`
        : `devw add <category>/<rule>`;
    ui.error(
      `Block format "${ruleArg}" is no longer supported`,
      `Use category/name format — e.g., ${hint}. Run devw add --list to browse.`,
    );
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

  if (category === 'preset') {
    const anyAdded = await installPreset(cwd, name, options);
    if (anyAdded && !options.noCompile) {
      const { runCompileFromAdd } = await import('./compile.js');
      await runCompileFromAdd();
    }
    return;
  }

  if (isAssetType(category)) {
    const added = await downloadAndInstallAsset(cwd, category, name, options);
    if (added && !options.noCompile) {
      const { runCompileFromAdd } = await import('./compile.js');
      await runCompileFromAdd();
    }
    return;
  }

  const added = await downloadAndInstall(cwd, category, name, options);

  if (added && !options.noCompile) {
    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
  }

  outroPrompt('Add command completed');
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
