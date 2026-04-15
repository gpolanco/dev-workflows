import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { Command } from 'commander';
import pc from 'picocolors';
import { stringify, parse } from 'yaml';
import {
  fetchRawContent,
  fetchContent,
  listContentDirectory,
  fetchRegistry as fetchRegistryManifest,
} from '../utils/github.js';
import { convert } from '../core/converter.js';
import { isAssetType, parseAssetFrontmatter } from '../core/assets.js';
import { fileExists } from '../utils/fs.js';
import { readConfig } from '../core/parser.js';
import { resolveContext } from '../core/resolve-context.js';
import {
  selectPrompt,
  multiselectPrompt,
  multiselectPromptOrBack,
  confirmPrompt,
  introPrompt,
  outroPrompt,
  notePrompt,
  spinnerTask,
  isInteractiveSession,
} from '../utils/prompt.js';
import { filterRegistryByTag, searchRegistry, type Registry, type RegistryRule } from '../utils/registry.js';
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
  search?: string;
  tag?: string;
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
    rules: Array<{ name: string; description: string; version: string; path: string; tags: string[] }>;
  }>;
  assets: Registry['assets'];
}

function toCategoryName(path: string): string {
  const slashIdx = path.indexOf('/');
  if (slashIdx <= 0) {
    return path;
  }
  return path.slice(0, slashIdx);
}

function toRuleName(path: string): string {
  const slashIdx = path.indexOf('/');
  if (slashIdx < 0 || slashIdx === path.length - 1) {
    return path;
  }
  return path.slice(slashIdx + 1);
}

function buildCachedRegistry(registry: Registry, rules: RegistryRule[]): CachedRegistry {
  const categoryMap = new Map<string, CachedRegistry['categories'][number]>();

  for (const rule of rules) {
    const category = toCategoryName(rule.path);
    const ruleEntry = {
      name: toRuleName(rule.path),
      description: rule.description,
      version: rule.version,
      path: rule.path,
      tags: rule.tags,
    };

    const existingCategory = categoryMap.get(category);
    if (existingCategory) {
      existingCategory.rules.push(ruleEntry);
      continue;
    }

    categoryMap.set(category, {
      name: category,
      rules: [ruleEntry],
    });
  }

  const categories = [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const category of categories) {
    category.rules.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    categories,
    assets: registry.assets,
  };
}

export async function fetchRegistry(cwd: string): Promise<CachedRegistry | null> {
  ui.info('Fetching available rules from GitHub...');
  ui.newline();

  try {
    const manifest = await spinnerTask({
      label: 'Fetching registry manifest',
      task: async () => fetchRegistryManifest(cwd),
    });

    return buildCachedRegistry(manifest, manifest.rules);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Could not fetch rule registry: ${msg}`);
    return null;
  }
}

function applyRuleFilters(
  manifest: Registry,
  searchTerm: string | undefined,
  tag: string | undefined,
): RegistryRule[] {
  let filtered = manifest.rules;

  if (tag && tag.trim().length > 0) {
    const taggedRegistry: Registry = {
      ...manifest,
      rules: filtered,
    };
    filtered = filterRegistryByTag(taggedRegistry, tag);
  }

  if (searchTerm && searchTerm.trim().length > 0) {
    const searchedRegistry: Registry = {
      ...manifest,
      rules: filtered,
    };
    filtered = searchRegistry(searchedRegistry, searchTerm);
  }

  return filtered;
}

async function runList(
  categoryFilter: string | undefined,
  searchTerm: string | undefined,
  tag: string | undefined,
): Promise<void> {
  const cwd = process.cwd();
  let manifest: Registry;

  try {
    manifest = await spinnerTask({
      label: 'Fetching registry manifest',
      task: async () => fetchRegistryManifest(cwd),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(`Could not fetch rule registry: ${msg}`);
    process.exitCode = 1;
    return;
  }

  const filteredRules = applyRuleFilters(manifest, searchTerm, tag);
  const registry = buildCachedRegistry(manifest, filteredRules);

  if (!registry) {
    process.exitCode = 1;
    return;
  }

  const displayCategories = categoryFilter
    ? registry.categories.filter((c) => c.name === categoryFilter)
    : registry.categories;

  if (displayCategories.length === 0) {
    if (searchTerm || tag) {
      ui.warn('No rules matched the applied filters');
    } else if (categoryFilter) {
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
    const assetEntries = [
      { type: 'command', names: registry.assets.commands },
      { type: 'template', names: registry.assets.templates },
      { type: 'hook', names: registry.assets.hooks },
      { type: 'preset', names: registry.assets.presets },
    ];

    const hasAnyAssets = assetEntries.some((entry) => entry.names.length > 0);

    if (hasAnyAssets) {
      ui.newline();
      ui.header('Available assets');
      ui.newline();
      for (const entry of assetEntries) {
        const names = entry.names;
        if (names.length === 0) continue;
        console.log(`  ${pc.cyan(`${entry.type}/`)}`);
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

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1] ?? '', 10);
  const minor = Number.parseInt(match[2] ?? '', 10);
  const patch = Number.parseInt(match[3] ?? '', 10);

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }

  return [major, minor, patch];
}

function compareSemver(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (!parsedA || !parsedB) {
    return a.localeCompare(b, undefined, { numeric: true });
  }

  const [majorA, minorA, patchA] = parsedA;
  const [majorB, minorB, patchB] = parsedB;

  if (majorA !== majorB) {
    return majorA - majorB;
  }

  if (minorA !== minorB) {
    return minorA - minorB;
  }

  if (patchA !== patchB) {
    return patchA - patchB;
  }

  return 0;
}

interface RuleVersionCheck {
  installedVersion?: string;
  registryVersion?: string;
  registryRule?: RegistryRule;
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
  versionCheck?: RuleVersionCheck,
): Promise<boolean> {
  const source = `${category}/${name}`;
  const fileName = `pulled-${category}-${name}.yml`;
  const filePath = join(cwd, '.dwf', 'rules', fileName);

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
    const installedVersion = versionCheck?.installedVersion;
    const registryVersion = versionCheck?.registryVersion;

    if (installedVersion && registryVersion) {
      const comparison = compareSemver(registryVersion, installedVersion);

      if (comparison === 0) {
        ui.success(`Already up to date (${source} v${registryVersion})`);
        return false;
      }

      if (comparison > 0 && !options.force) {
        ui.newline();
        ui.info(`${source} update available (v${installedVersion} ${ICONS.arrow} v${registryVersion})`);
        try {
          const shouldUpdate = await confirmPrompt({
            message: 'Install update?',
            defaultValue: true,
          });
          if (!shouldUpdate) {
            ui.error('Cancelled');
            return false;
          }
        } catch {
          ui.error('Cancelled');
          return false;
        }
      }
    }

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

      const selected = await multiselectPromptOrBack<string>({
        message: `Select rules to add  ${pc.dim('(Esc ← back)')}`,
        options: category.rules.map((r) => {
          const path = `${category.name}/${r.name}`;
          const installed = installedPaths.has(path);
          const desc = r.description ? ` ${ICONS.dash} ${r.description}` : '';
          const suffix = installed ? pc.dim(' (already installed)') : '';
          return {
            label: `${r.name}${desc}${suffix}`,
            value: r.name,
          };
        }),
      });

      if (selected === null) continue;

      if (selected.length === 0) {
        ui.warn('No rules selected');
        continue;
      }

      for (const ruleName of selected) {
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

  const dest = '.dwf/rules/';
  const maxLen = Math.max(...allSelected.map((r) => `${r.category}/${r.name}`.length));
  const summaryLines = allSelected
    .map((r) => {
      const rulePath = `${r.category}/${r.name}`;
      return `${rulePath.padEnd(maxLen)}  ${ICONS.arrow} ${dest}`;
    })
    .join('\n');
  notePrompt(summaryLines, `Installing ${pluralRules(allSelected.length)}`);

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

async function resolveRuleVersionCheck(cwd: string, source: string): Promise<RuleVersionCheck | undefined> {
  let installedVersion: string | undefined;
  try {
    const config = await readConfig(cwd);
    installedVersion = config.pulled.find((entry) => entry.path === source)?.version;
  } catch {
    installedVersion = undefined;
  }

  let registryVersion: string | undefined;
  let registryRule: RegistryRule | undefined;
  try {
    const registry = await fetchRegistryManifest(cwd);
    const found = registry.rules.find((rule) => rule.path === source);
    registryVersion = found?.version;
    registryRule = found ?? undefined;
  } catch {
    registryVersion = undefined;
  }

  if (!installedVersion && !registryVersion) {
    return undefined;
  }

  return {
    installedVersion,
    registryVersion,
    registryRule,
  };
}

export async function runAdd(ruleArg: string | undefined, options: AddOptions): Promise<void> {
  if (options.list) {
    await runList(ruleArg, options.search, options.tag);
    return;
  }

  const resolved = await resolveContext(process.cwd());

  if (!resolved) {
    ui.error('No devw configuration found.', 'Run "devw init" to set up a project or global configuration.');
    process.exitCode = 1;
    return;
  }

  const cwd = resolved.configRoot;

  if (resolved.globalMode) {
    ui.info('Adding to global config (~/.dwf)');
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

  const source = `${category}/${name}`;
  const versionCheck = await resolveRuleVersionCheck(cwd, source);

  // Preview card in interactive mode (without --force or --dry-run)
  if (isInteractiveSession() && !options.force && !options.dryRun) {
    const dest = '.dwf/rules/';
    const noteLines = `${source.padEnd(source.length)}  ${ICONS.arrow} ${dest}`;

    notePrompt(noteLines, `Installing 1 rule`);

    try {
      const confirmed = await confirmPrompt({ message: 'Install?', defaultValue: true });
      if (!confirmed) {
        outroPrompt('Cancelled.');
        return;
      }
    } catch {
      return;
    }
  }

  const added = await downloadAndInstall(cwd, category, name, options, versionCheck);

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
    .option('--search <term>', 'Filter listed rules by search terms')
    .option('--tag <tag>', 'Filter listed rules by tag')
    .option('--no-compile', 'Skip auto-compile after adding')
    .option('--force', 'Overwrite without asking')
    .option('--dry-run', 'Show output without writing files')
    .action((rule: string | undefined, options: AddOptions) => runAdd(rule, options));
}
