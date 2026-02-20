import { join } from 'node:path';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import type { Command } from 'commander';
import { parse, stringify } from 'yaml';
import { checkbox, confirm } from '@inquirer/prompts';
import { readConfig } from '../core/parser.js';
import { fileExists } from '../utils/fs.js';
import { isAssetType, removeAsset } from '../core/assets.js';
import { validateInput } from './add.js';
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

async function runRemove(ruleArg: string | undefined): Promise<void> {
  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);

  if (!ruleArg) {
    if (config.pulled.length === 0) {
      ui.warn('No rules installed');
      return;
    }

    let selectedRules: string[];
    try {
      selectedRules = await checkbox<string>({
        message: 'Which rules to remove?',
        choices: config.pulled.map((p) => ({
          name: `${p.path} (v${p.version})`,
          value: p.path,
        })),
      });
    } catch {
      return;
    }

    if (selectedRules.length === 0) {
      ui.warn('No rules selected');
      return;
    }

    try {
      const shouldProceed = await confirm({
        message: `Remove ${String(selectedRules.length)} rule(s)?`,
        default: true,
      });
      if (!shouldProceed) {
        ui.info('Remove cancelled');
        return;
      }
    } catch {
      return;
    }

    for (const path of selectedRules) {
      await removeRule(cwd, path);
      ui.success(`Removed ${path}`);
    }

    const { runCompileFromAdd } = await import('./compile.js');
    await runCompileFromAdd();
    return;
  }

  if (!ruleArg.includes('/')) {
    ui.error('Block format is no longer supported', 'Use: devw remove <category>/<rule>');
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
}

export function registerRemoveCommand(program: Command): void {
  program
    .command('remove')
    .argument('[rule]', 'Rule path: <category>/<rule>')
    .description('Remove an installed rule')
    .action((rule?: string) => runRemove(rule));
}
