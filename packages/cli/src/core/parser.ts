import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Rule, ProjectConfig, PulledEntry } from '../bridges/types.js';
import { isValidScope } from './schema.js';

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

  return {
    version,
    project: { name: projectName, description: projectDescription },
    tools,
    mode: modeRaw,
    blocks,
    pulled,
  };
}

function normalizeRule(raw: RawRule, scope: string): Rule | null {
  if (!raw.id || !raw.content) return null;

  const severity = raw.severity ?? 'error';
  if (severity !== 'error' && severity !== 'warning' && severity !== 'info') return null;

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
  };
}

export async function readRules(cwd: string): Promise<Rule[]> {
  const rulesDir = join(cwd, '.dwf', 'rules');
  const entries = await readdir(rulesDir);
  const ymlFiles = entries.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

  const allRules: Rule[] = [];

  for (const file of ymlFiles) {
    const raw = await readFile(join(rulesDir, file), 'utf-8');
    const parsed: unknown = parse(raw);

    if (!parsed || typeof parsed !== 'object') continue;

    const doc = parsed as RawRuleFile;
    const scope = doc.scope ?? file.replace(/\.ya?ml$/, '');

    if (!Array.isArray(doc.rules)) continue;

    if (!isValidScope(scope)) {
      console.warn(`Warning: invalid scope "${scope}" in ${file}, skipping rules`);
      continue;
    }

    for (const rawRule of doc.rules) {
      if (!rawRule || typeof rawRule !== 'object') continue;
      const rule = normalizeRule(rawRule, scope);
      if (rule) allRules.push(rule);
    }
  }

  return allRules;
}
