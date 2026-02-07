import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { Rule } from '../bridges/types.js';

export interface BlockDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: BlockRule[];
}

export interface BlockRule {
  id: string;
  scope: string;
  severity: 'error' | 'warning' | 'info';
  content: string;
}

interface RawBlockRule {
  id?: string;
  scope?: string;
  severity?: string;
  content?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function defaultBlocksDir(): string {
  // From dist/blocks/ → packages/cli/ (2 up), then content/blocks
  return join(__dirname, '..', '..', 'content', 'blocks');
}

function normalizeBlockRule(raw: RawBlockRule): BlockRule | null {
  if (!raw.id || !raw.scope || !raw.content) return null;

  const severity = raw.severity ?? 'error';
  if (severity !== 'error' && severity !== 'warning' && severity !== 'info') return null;

  return {
    id: raw.id,
    scope: raw.scope,
    severity,
    content: raw.content.trimEnd(),
  };
}

function parseBlock(raw: string): BlockDefinition | null {
  const parsed: unknown = parse(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  const doc = parsed as Record<string, unknown>;
  const id = typeof doc['id'] === 'string' ? doc['id'] : null;
  const name = typeof doc['name'] === 'string' ? doc['name'] : null;
  const description = typeof doc['description'] === 'string' ? doc['description'] : '';
  const version = typeof doc['version'] === 'string' ? doc['version'] : '0.1.0';

  if (!id || !name) return null;

  const rulesRaw = doc['rules'];
  if (!Array.isArray(rulesRaw)) return null;

  const rules: BlockRule[] = [];
  for (const rawRule of rulesRaw) {
    if (!rawRule || typeof rawRule !== 'object') continue;
    const rule = normalizeBlockRule(rawRule as RawBlockRule);
    if (rule) rules.push(rule);
  }

  return { id, name, description, version, rules };
}

export async function loadAllBlocks(blocksDir?: string): Promise<BlockDefinition[]> {
  const dir = blocksDir ?? defaultBlocksDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const ymlFiles = entries.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  const blocks: BlockDefinition[] = [];

  for (const file of ymlFiles) {
    try {
      const raw = await readFile(join(dir, file), 'utf-8');
      const block = parseBlock(raw);
      if (block) blocks.push(block);
    } catch {
      // Skip files that can't be read or parsed
    }
  }

  return blocks;
}

export async function loadBlock(blockId: string, blocksDir?: string): Promise<BlockDefinition | null> {
  const all = await loadAllBlocks(blocksDir);
  return all.find((b) => b.id === blockId) ?? null;
}

export function blockRulesToRules(block: BlockDefinition): Rule[] {
  return block.rules.map((r) => ({
    id: r.id,
    scope: r.scope,
    severity: r.severity,
    content: r.content,
    enabled: true,
    sourceBlock: block.id,
  }));
}
