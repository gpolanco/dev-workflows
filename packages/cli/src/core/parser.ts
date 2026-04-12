import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Rule, ProjectConfig, PulledEntry, AssetEntry, AssetType, ScopeMetadata } from '../bridges/types.js';
import { ASSET_TYPE } from '../bridges/types.js';
import { isValidScope, validateScopeMetadata, VALID_CONFIG_VERSIONS } from './schema.js';

interface RawRule {
  id?: string;
  severity?: string;
  content?: string;
  tags?: string[];
  enabled?: boolean;
  sourceBlock?: string;
  source?: string;
}

interface RawRuleFile {
  scope?: string;
  metadata?: Record<string, unknown>;
  globs?: unknown;
  paths?: unknown;
  trigger?: unknown;
  rules?: RawRule[];
}

export async function readConfig(cwd: string): Promise<ProjectConfig> {
  const configPath = join(cwd, '.dwf', 'config.yml');
  const raw = await readFile(configPath, 'utf-8');
  const parsed: unknown = parse(raw);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid config.yml: expected an object');
  }

  const doc = parsed as Record<string, unknown>;

  const version = typeof doc['version'] === 'string' ? doc['version'] : '0.1';

  const validVersions = VALID_CONFIG_VERSIONS as readonly string[];
  if (!validVersions.includes(version)) {
    throw new Error(`Invalid config.yml: unsupported version "${version}". Supported versions: ${VALID_CONFIG_VERSIONS.join(', ')}`);
  }

  const projectRaw = doc['project'];
  if (!projectRaw || typeof projectRaw !== 'object') {
    throw new Error('Invalid config.yml: missing "project" section');
  }
  const projectObj = projectRaw as Record<string, unknown>;
  const projectName = typeof projectObj['name'] === 'string' ? projectObj['name'] : '';
  const projectDescription = typeof projectObj['description'] === 'string' ? projectObj['description'] : undefined;

  const toolsRaw = doc['tools'];
  if (!Array.isArray(toolsRaw)) {
    throw new Error('Invalid config.yml: "tools" must be an array');
  }
  const tools = toolsRaw.filter((t): t is string => typeof t === 'string');

  const modeRaw = doc['mode'];
  if (modeRaw !== 'copy' && modeRaw !== 'link') {
    throw new Error('Invalid config.yml: "mode" must be "copy" or "link"');
  }

  const blocksRaw = doc['blocks'];
  const blocks = Array.isArray(blocksRaw)
    ? blocksRaw.filter((b): b is string => typeof b === 'string')
    : [];

  const pulledRaw = doc['pulled'];
  const pulled: PulledEntry[] = Array.isArray(pulledRaw)
    ? pulledRaw
        .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
        .map((p) => ({
          path: typeof p['path'] === 'string' ? p['path'] : '',
          version: typeof p['version'] === 'string' ? p['version'] : '',
          pulled_at: typeof p['pulled_at'] === 'string' ? p['pulled_at'] : '',
        }))
        .filter((p) => p.path !== '')
    : [];

  const assetTypeValues = new Set<string>(Object.values(ASSET_TYPE));
  const assetsRaw = doc['assets'];
  const assets: AssetEntry[] = Array.isArray(assetsRaw)
    ? assetsRaw
        .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
        .map((a) => ({
          type: (typeof a['type'] === 'string' ? a['type'] : '') as AssetType,
          name: typeof a['name'] === 'string' ? a['name'] : '',
          version: typeof a['version'] === 'string' ? a['version'] : '',
          installed_at: typeof a['installed_at'] === 'string' ? a['installed_at'] : '',
        }))
        .filter((a) => a.name !== '' && assetTypeValues.has(a.type))
    : [];

  const globalRaw = doc['global'];
  const global = typeof globalRaw === 'boolean' ? globalRaw : true;

  return {
    version,
    project: { name: projectName, description: projectDescription },
    tools,
    mode: modeRaw,
    blocks,
    pulled,
    assets,
    global,
  };
}

function normalizeRule(raw: RawRule, scope: string, scopeMetadata?: ScopeMetadata): Rule | null {
  if (!raw.id || !raw.content) {
    return null;
  }

  const severity = raw.severity ?? 'error';
  if (severity !== 'error' && severity !== 'warning' && severity !== 'info') {
    return null;
  }

  const enabled = raw.enabled !== false;

  return {
    id: raw.id,
    scope,
    severity,
    content: raw.content.trimEnd(),
    tags: raw.tags,
    enabled,
    sourceBlock: raw.sourceBlock,
    source: raw.source,
    metadata: scopeMetadata,
  };
}

function extractScopeMetadata(doc: RawRuleFile, file: string): ScopeMetadata | undefined {
  // Support both nested metadata block and top-level fields
  const metadataRaw: Record<string, unknown> = {};

  if (doc.metadata && typeof doc.metadata === 'object') {
    Object.assign(metadataRaw, doc.metadata);
  }

  // Top-level fields take precedence over nested metadata block
  if (doc.globs !== undefined) {
    metadataRaw['globs'] = doc.globs;
  }
  if (doc.paths !== undefined) {
    metadataRaw['paths'] = doc.paths;
  }
  if (doc.trigger !== undefined) {
    metadataRaw['trigger'] = doc.trigger;
  }

  if (Object.keys(metadataRaw).length === 0) {
    return undefined;
  }

  const { metadata, errors } = validateScopeMetadata(metadataRaw);

  for (const error of errors) {
    console.warn(`Warning: ${error.field} in ${file}: ${error.message}`);
  }

  if (errors.length > 0) {
    return undefined;
  }

  return metadata;
}

export async function readRules(cwd: string): Promise<Rule[]> {
  const rulesDir = join(cwd, '.dwf', 'rules');
  let entries: string[];
  try {
    entries = await readdir(rulesDir);
  } catch {
    return [];
  }
  const ymlFiles = entries.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  const allRules: Rule[] = [];

  for (const file of ymlFiles) {
    const raw = await readFile(join(rulesDir, file), 'utf-8');
    const parsed: unknown = parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      continue;
    }

    const doc = parsed as RawRuleFile;
    const scope = doc.scope ?? file.replace(/\.ya?ml$/, '');

    if (!Array.isArray(doc.rules)) {
      continue;
    }

    if (!isValidScope(scope)) {
      console.warn(`Warning: invalid scope "${scope}" in ${file}, skipping rules`);
      continue;
    }

    const scopeMetadata = extractScopeMetadata(doc, file);

    for (const rawRule of doc.rules) {
      if (!rawRule || typeof rawRule !== 'object') {
        continue;
      }
      const rule = normalizeRule(rawRule, scope, scopeMetadata);
      if (rule) {
        allRules.push(rule);
      }
    }
  }

  return allRules;
}
