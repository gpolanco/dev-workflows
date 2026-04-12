import { join } from 'node:path';
import { fetchWithETag } from './cache.js';
import type { Registry, RegistryAssets, RegistryRule } from './registry.js';

const BRANCH = 'main';
const REPO = 'gpolanco/dev-workflows';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/content`;
const API_BASE = `https://api.github.com/repos/${REPO}/contents/content`;
const REGISTRY_URL = `${RAW_BASE}/registry.json`;

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

function handleResponseError(status: number, path: string): never {
  if (status === 404) {
    throw new GitHubError(`Content not found: ${path}`, 404);
  }
  if (status === 403) {
    throw new GitHubError(
      'GitHub API rate limit exceeded. Try again later or set a GITHUB_TOKEN environment variable.',
      403,
    );
  }
  throw new GitHubError(`GitHub request failed (HTTP ${String(status)})`, status);
}

export async function fetchContent(contentPath: string): Promise<string> {
  const url = `${RAW_BASE}/${contentPath}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitHubError(`Network error fetching content: ${msg}`, 0);
  }

  if (!response.ok) {
    handleResponseError(response.status, contentPath);
  }

  return response.text();
}

export async function fetchRawContent(path: string): Promise<string> {
  return fetchContent(`rules/${path}.md`);
}

interface GitHubContentsEntry {
  name: string;
  type: string;
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'dir';
}

export async function listContentDirectory(contentPath: string): Promise<DirectoryEntry[]> {
  const url = `${API_BASE}/${contentPath}?ref=${BRANCH}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  const token = process.env['GITHUB_TOKEN'];
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GitHubError(`Network error listing directory: ${msg}`, 0);
  }

  if (!response.ok) {
    handleResponseError(response.status, contentPath);
  }

  const data = (await response.json()) as GitHubContentsEntry[];

  return data
    .filter((entry) => entry.type === 'file' || entry.type === 'dir')
    .map((entry) => ({
      name: entry.name.replace(/\.md$/, '').replace(/\.json$/, '').replace(/\.yml$/, ''),
      type: entry.type === 'dir' ? ('dir' as const) : ('file' as const),
    }));
}

export async function listDirectory(path?: string): Promise<DirectoryEntry[]> {
  const contentPath = path ? `rules/${path}` : 'rules';
  const entries = await listContentDirectory(contentPath);
  return entries.map((entry) => ({
    name: entry.name.replace(/\.md$/, ''),
    type: entry.type,
  }));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseRegistryRule(value: unknown): RegistryRule | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record['path'] !== 'string' ||
    typeof record['name'] !== 'string' ||
    typeof record['description'] !== 'string' ||
    typeof record['version'] !== 'string' ||
    typeof record['scope'] !== 'string' ||
    !isStringArray(record['tags']) ||
    typeof record['size_bytes'] !== 'number'
  ) {
    return null;
  }

  return {
    path: record['path'],
    name: record['name'],
    description: record['description'],
    version: record['version'],
    scope: record['scope'],
    tags: record['tags'],
    size_bytes: record['size_bytes'],
  };
}

function parseRegistryAssets(value: unknown): RegistryAssets | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    !isStringArray(record['commands']) ||
    !isStringArray(record['templates']) ||
    !isStringArray(record['hooks']) ||
    !isStringArray(record['presets'])
  ) {
    return null;
  }

  return {
    commands: record['commands'],
    templates: record['templates'],
    hooks: record['hooks'],
    presets: record['presets'],
  };
}

function parseRegistry(value: unknown): Registry {
  if (!value || typeof value !== 'object') {
    throw new GitHubError('Invalid registry.json: expected an object', 0);
  }

  const record = value as Record<string, unknown>;
  const rulesRaw = record['rules'];
  if (!Array.isArray(rulesRaw)) {
    throw new GitHubError('Invalid registry.json: missing rules array', 0);
  }

  const rules: RegistryRule[] = [];
  for (const rule of rulesRaw) {
    const parsed = parseRegistryRule(rule);
    if (parsed === null) {
      throw new GitHubError('Invalid registry.json: rule entry has invalid shape', 0);
    }
    rules.push(parsed);
  }

  const assets = parseRegistryAssets(record['assets']);
  if (assets === null) {
    throw new GitHubError('Invalid registry.json: invalid assets object', 0);
  }

  if (typeof record['version'] !== 'number' || typeof record['generated_at'] !== 'string') {
    throw new GitHubError('Invalid registry.json: missing version or generated_at', 0);
  }

  return {
    version: record['version'],
    generated_at: record['generated_at'],
    rules,
    assets,
  };
}

export async function fetchRegistry(cwd: string): Promise<Registry> {
  const cacheDir = join(cwd, '.dwf', '.cache');

  try {
    const result = await fetchWithETag<unknown>(REGISTRY_URL, cacheDir, 'registry');
    return parseRegistry(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GitHubError(`Could not fetch registry manifest: ${message}`, 0);
  }
}
