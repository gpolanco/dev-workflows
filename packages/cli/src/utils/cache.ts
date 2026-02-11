import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const TTL_MS = 3_600_000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

type CacheStore = Record<string, CacheEntry<unknown>>;

function getCachePath(cwd: string): string {
  return join(cwd, '.dwf', '.cache', 'registry.json');
}

async function readStore(cwd: string): Promise<CacheStore> {
  try {
    const raw = await readFile(getCachePath(cwd), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CacheStore;
    }
    return {};
  } catch {
    return {};
  }
}

async function writeStore(cwd: string, store: CacheStore): Promise<void> {
  const cachePath = getCachePath(cwd);
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(store, null, 2), 'utf-8');
}

export function get<T>(_cwd: string, key: string, store: CacheStore): T | null {
  const entry = store[key] as CacheEntry<T> | undefined;
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > TTL_MS) return null;

  return entry.data;
}

export async function getFromDisk<T>(cwd: string, key: string): Promise<T | null> {
  const store = await readStore(cwd);
  return get<T>(cwd, key, store);
}

export async function set<T>(cwd: string, key: string, value: T): Promise<void> {
  const store = await readStore(cwd);
  store[key] = { data: value, timestamp: Date.now() };
  await writeStore(cwd, store);
}
