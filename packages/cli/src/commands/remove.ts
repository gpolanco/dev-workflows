import { join } from 'node:path';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import type { Command } from 'commander';
import { parse, stringify } from 'yaml';
import { readConfig } from '../core/parser.js';
import { fileExists } from '../utils/fs.js';
import { isAssetType, removeAsset } from '../core/assets.js';
import { validateInput } from './add.js';
import { multiselectPrompt, confirmPrompt, introPrompt, outroPrompt, isInteractiveSession } from '../utils/prompt.js';
import * as ui from '../utils/ui.js';
import type { PulledEntry, AssetEntry } from '../bridges/types.js';

async function removePulledEntry(cwd: string, path: string): Promise<void> {
  const configPath = join(cwd, '.dwf', 'config.yml');
  const raw = await readFile(configPath, 'utf-8');
  const doc = parse(raw) as Record<string, unknown>;

  const pulled = Array.isArray(doc['pulled']) ? (doc['pulled'] as PulledEntry[]) : [];
  doc['pulled'] = pulled.filter((p) => p.path !== path);

  await writeFile(configPath, stringify(doc, { lineWidth: 0 }), 'utf-8');
}

async function removeAssetEntry(cwd: string, type: string, name: string): Promise<void> {
  const configPath = join(cwd, '.dwf', 'config.yml');
  const raw = await readFile(configPath, 'utf-8');
  const doc = parse(raw) as Record<string, unknown>;

  const assets = Array.isArray(doc['assets']) ? (doc['assets'] as AssetEntry[]) : [];
  doc['assets'] = assets.filter((a) => !(a.type === type && a.name === name));

  await writeFile(configPath, stringify(doc, { lineWidth: 0 }), 'utf-8');
}

async function removeRule(cwd: string, path: string): Promise<boolean> {
  const parts = path.split('/');
  if (parts.length !== 2) return false;

  const category = parts[0];
  const name = parts[1];
  if (!category || !name) return false;

  const fileName = `pulled-${category}-${name}.yml`;
  const filePath = join(cwd, '.dwf', 'rules', fileName);

  if (await fileExists(filePath)) {
    await unlink(filePath);
  }

  await removePulledEntry(cwd, path);
  return true;
}

export async function runRemove(ruleArg: string | undefined): Promise<void> {
  const cwd = process.cwd();

  if (isInteractiveSession()) {
    introPrompt('Remove rules or assets');
  }

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);

  if (!ruleArg) {
    if (!isInteractiveSession()) {
      ui.error('No rule specified', 'Usage: devw remove <category>/<rule>');
      process.exitCode = 1;
      return;
    }

    const hasRules = config.pulled.length > 0;
    const hasAssets = config.assets.length > 0;

    if (!hasRules && !hasAssets) {
      ui.warn('Nothing installed to remove');
      return;
    }

    type RemoveChoice = { kind: 'rule'; path: string } | { kind: 'asset'; type: string; name: string };

    const choices: RemoveChoice[] = [];

    if (hasRules) {
      for (const p of config.pulled) {
        choices.push({ kind: 'rule', path: p.path });
      }
    }

    if (hasAssets) {
      for (const a of config.assets) {
        choices.push({ kind: 'asset', type: a.type, name: a.name });
      }
    }

    let selected: RemoveChoice[];
    try {
      selected = await multiselectPrompt<RemoveChoice>({
        message: 'Select items to remove',
        options: choices.map((c) => {
          if (c.kind === 'rule') {
            const entry = config.pulled.find((p) => p.path === c.path);
            return { label: `[rule] ${c.path} (v${entry?.version ?? '?'})`, value: c };
          }
          return { label: `[asset] ${c.type}/${c.name}`, value: c };
        }),
      });
    } catch {
      return;
    }

    if (selected.length === 0) {
      ui.warn('Nothing selected');
      return;
    }

    try {
      const shouldProceed = await confirmPrompt({
        message: `Remove ${String(selected.length)} item(s)?`,
        defaultValue: true,
      });
      if (!shouldProceed) {
        ui.info('Remove cancelled');
        return;
      }
    } catch {
      return;
    }

    for (const item of selected) {
      if (item.kind === 'rule') {
        await removeRule(cwd, item.path);
        ui.success(`Removed ${item.path}`);
      } else {
        await removeAsset(cwd, item.type as Parameters<typeof removeAsset>[1], item.name);
        await removeAssetEntry(cwd, item.type, item.name);
        ui.success(`Removed ${item.type}/${item.name}`);
      }
    }

    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
    outroPrompt('Remove command completed');
    return;
  }

  if (!ruleArg.includes('/')) {
    const dashIdx = ruleArg.indexOf('-');
    const hint =
      dashIdx > 0
        ? `devw remove ${ruleArg.slice(0, dashIdx)}/${ruleArg.slice(dashIdx + 1)}`
        : `devw remove <category>/<rule>`;
    ui.error(
      `Block format "${ruleArg}" is no longer supported`,
      `Use category/name format — e.g., ${hint}`,
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

  if (isAssetType(category)) {
    const installed = config.assets.find((a) => a.type === category && a.name === name);
    if (!installed) {
      ui.error(
        `Asset "${category}/${name}" is not installed`,
        config.assets.length > 0
          ? `Installed assets: ${config.assets.map((a) => `${a.type}/${a.name}`).join(', ')}`
          : 'No assets installed',
      );
      process.exitCode = 1;
      return;
    }

    await removeAsset(cwd, category, name);
    await removeAssetEntry(cwd, category, name);
    ui.success(`Removed ${category}/${name}`);

    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
    outroPrompt('Remove command completed');
    return;
  }

  const source = `${category}/${name}`;
  const installed = config.pulled.find((p) => p.path === source);
  if (!installed) {
    ui.error(
      `Rule "${source}" is not installed`,
      config.pulled.length > 0
        ? `Installed rules: ${config.pulled.map((p) => p.path).join(', ')}`
        : 'No rules installed',
    );
    process.exitCode = 1;
    return;
  }

  await removeRule(cwd, source);
  ui.success(`Removed ${source}`);

  const { runCompileFromAdd } = await import('./compile.js');
  await runCompileFromAdd();
  outroPrompt('Remove command completed');
}

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .argument('[rule]', 'Rule path: <category>/<rule>')
    .description('Remove an installed rule')
    .action((rule?: string) => runRemove(rule));
}
