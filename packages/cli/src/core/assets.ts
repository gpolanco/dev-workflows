import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AssetType, ProjectConfig } from '../bridges/types.js';
import { ASSET_TYPE } from '../bridges/types.js';
import { fileExists } from '../utils/fs.js';
import { mergeSettingsFile, type JsonValue } from './settings-merge.js';

const ASSET_TYPE_VALUES = new Set<string>(Object.values(ASSET_TYPE));

export function isAssetType(category: string): category is AssetType {
  return ASSET_TYPE_VALUES.has(category);
}

export interface AssetFrontmatter {
  name: string;
  description: string;
  version: string;
  tool?: string;
  output_path?: string;
}

export function parseAssetFrontmatter(content: string): { frontmatter: AssetFrontmatter; body: string } {
  const fmRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = fmRegex.exec(content);

  if (!match?.[1]) {
    return {
      frontmatter: { name: '', description: '', version: '0.1.0' },
      body: content,
    };
  }

  const raw: unknown = parseYaml(match[1]);
  if (!raw || typeof raw !== 'object') {
    return {
      frontmatter: { name: '', description: '', version: '0.1.0' },
      body: match[2] ?? '',
    };
  }

  const fm = raw as Record<string, unknown>;

  return {
    frontmatter: {
      name: typeof fm['name'] === 'string' ? fm['name'] : '',
      description: typeof fm['description'] === 'string' ? fm['description'] : '',
      version: typeof fm['version'] === 'string' ? fm['version'] : '0.1.0',
      tool: typeof fm['tool'] === 'string' ? fm['tool'] : undefined,
      output_path: typeof fm['output_path'] === 'string' ? fm['output_path'] : undefined,
    },
    body: match[2] ?? '',
  };
}

export interface AssetFile {
  type: AssetType;
  name: string;
  content: string;
}

export async function readAssets(cwd: string): Promise<AssetFile[]> {
  const assetsDir = join(cwd, '.dwf', 'assets');
  const assets: AssetFile[] = [];

  for (const type of Object.values(ASSET_TYPE)) {
    const typeDir = join(assetsDir, `${type}s`);
    if (!(await fileExists(typeDir))) continue;

    let entries: string[];
    try {
      entries = await readdir(typeDir);
    } catch {
      continue;
    }

    for (const file of entries) {
      const filePath = join(typeDir, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const name = file.replace(/\.(md|json|yml|yaml)$/, '');
        assets.push({ type, name, content });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return assets;
}

export interface DeployResult {
  deployed: string[];
}

export async function deployCommands(cwd: string, _config: ProjectConfig): Promise<DeployResult> {
  const commandsDir = join(cwd, '.dwf', 'assets', 'commands');
  const outputDir = join(cwd, '.claude', 'commands');
  const deployed: string[] = [];

  if (!(await fileExists(commandsDir))) return { deployed };

  let entries: string[];
  try {
    entries = await readdir(commandsDir);
  } catch {
    return { deployed };
  }

  await mkdir(outputDir, { recursive: true });

  for (const file of entries) {
    if (!file.endsWith('.md')) continue;
    const content = await readFile(join(commandsDir, file), 'utf-8');
    const { body } = parseAssetFrontmatter(content);
    const outputPath = join(outputDir, file);
    await writeFile(outputPath, body.trimStart(), 'utf-8');
    deployed.push(`.claude/commands/${file}`);
  }

  return { deployed };
}

export async function deployTemplates(cwd: string, _config: ProjectConfig): Promise<DeployResult> {
  const templatesDir = join(cwd, '.dwf', 'assets', 'templates');
  const deployed: string[] = [];

  if (!(await fileExists(templatesDir))) return { deployed };

  let entries: string[];
  try {
    entries = await readdir(templatesDir);
  } catch {
    return { deployed };
  }

  for (const file of entries) {
    if (!file.endsWith('.md')) continue;
    const content = await readFile(join(templatesDir, file), 'utf-8');
    const { frontmatter, body } = parseAssetFrontmatter(content);
    const outputPath = frontmatter.output_path ?? 'docs/specs';
    const outputDir = join(cwd, outputPath);
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, file), body.trimStart(), 'utf-8');
    deployed.push(`${outputPath}/${file}`);
  }

  return { deployed };
}

export async function deployHooks(cwd: string, _config: ProjectConfig): Promise<DeployResult> {
  const hooksDir = join(cwd, '.dwf', 'assets', 'hooks');
  const deployed: string[] = [];

  if (!(await fileExists(hooksDir))) return { deployed };

  let entries: string[];
  try {
    entries = await readdir(hooksDir);
  } catch {
    return { deployed };
  }

  for (const file of entries) {
    if (!file.endsWith('.json')) continue;
    const content = await readFile(join(hooksDir, file), 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }

    if (!parsed || typeof parsed !== 'object') continue;
    const hookDoc = parsed as Record<string, unknown>;
    const settings = hookDoc['settings'];
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) continue;

    await mergeSettingsFile(cwd, settings as Record<string, JsonValue>);
    deployed.push('.claude/settings.local.json');
  }

  return { deployed: [...new Set(deployed)] };
}

export async function deployAssets(cwd: string, config: ProjectConfig): Promise<DeployResult> {
  const allDeployed: string[] = [];

  const commandResult = await deployCommands(cwd, config);
  allDeployed.push(...commandResult.deployed);

  const templateResult = await deployTemplates(cwd, config);
  allDeployed.push(...templateResult.deployed);

  const hookResult = await deployHooks(cwd, config);
  allDeployed.push(...hookResult.deployed);

  return { deployed: allDeployed };
}

export async function removeAsset(cwd: string, type: AssetType, name: string): Promise<boolean> {
  const ext = type === 'hook' ? 'json' : 'md';
  const filePath = join(cwd, '.dwf', 'assets', `${type}s`, `${name}.${ext}`);

  if (!(await fileExists(filePath))) return false;

  await unlink(filePath);
  return true;
}
