#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT_DIR = process.cwd();
const RULES_DIR = join(ROOT_DIR, 'content', 'rules');
const OUTPUT_PATH = join(ROOT_DIR, 'content', 'registry.json');

function parseScalar(value) {
  const trimmed = value.trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseTags(raw) {
  const value = raw.trim();
  if (!value.startsWith('[') || !value.endsWith(']')) {
    return [];
  }

  const inner = value.slice(1, -1).trim();
  if (inner.length === 0) {
    return [];
  }

  return inner
    .split(',')
    .map((entry) => parseScalar(entry))
    .filter((entry) => entry.length > 0);
}

function parseFrontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!match || !match[1]) {
    return null;
  }

  const metadata = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (key === 'tags') {
      metadata.tags = parseTags(rawValue);
      continue;
    }

    metadata[key] = parseScalar(rawValue);
  }

  return metadata;
}

async function collectMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(absolutePath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function normalizeRulePath(absolutePath) {
  const relativePath = relative(RULES_DIR, absolutePath).replaceAll('\\', '/');
  return relativePath.replace(/\.md$/, '');
}

async function buildRegistry() {
  const markdownFiles = await collectMarkdownFiles(RULES_DIR);
  const rules = [];

  for (const filePath of markdownFiles) {
    if (filePath.endsWith('/README.md')) {
      continue;
    }

    const markdown = await readFile(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(markdown);
    if (!frontmatter) {
      continue;
    }

    const fileStats = await stat(filePath);
    rules.push({
      path: normalizeRulePath(filePath),
      name: typeof frontmatter.name === 'string' ? frontmatter.name : '',
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      version: typeof frontmatter.version === 'string' ? frontmatter.version : '',
      scope: typeof frontmatter.scope === 'string' ? frontmatter.scope : '',
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      size_bytes: fileStats.size,
    });
  }

  rules.sort((a, b) => a.path.localeCompare(b.path));

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    rules,
    assets: {
      commands: [],
      templates: [],
      hooks: [],
      presets: [],
    },
  };
}

async function main() {
  const registry = await buildRegistry();
  await writeFile(OUTPUT_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
  console.log(`Generated ${registry.rules.length} rules in content/registry.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
