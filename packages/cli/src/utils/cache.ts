import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as ui from './ui.js';
import { fileExists } from './fs.js';

const TTL_MS = 3_600_000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

type CacheStore = Record<string, CacheEntry<unknown>>;

function getCachePath(cwd: string): string {
  return join(cwd, '.dwf', '.cache', 'registry-store.json');
}

function getETagDataPath(cacheDir: string, cacheKey: string): string {
  return join(cacheDir, `${cacheKey}.json`);
}

function getETagPath(cacheDir: string, cacheKey: string): string {
  return join(cacheDir, `${cacheKey}.etag`);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
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

export interface FetchWithETagResult<T> {
  data: T;
  fromCache: boolean;
}

export async function fetchWithETag<T>(
  url: string,
  cacheDir: string,
  cacheKey: string,
): Promise<FetchWithETagResult<T>> {
  const dataPath = getETagDataPath(cacheDir, cacheKey);
  const etagPath = getETagPath(cacheDir, cacheKey);

  const headers: Record<string, string> = {};
  const cachedETagRaw = await readTextFile(etagPath);
  const cachedETag = typeof cachedETagRaw === 'string' ? cachedETagRaw.trim() : '';
  if (cachedETag.length > 0) {
    headers['If-None-Match'] = cachedETag;
  }

  try {
    const response = await fetch(url, { headers });

    if (response.status === 304) {
      const cachedData = await readJsonFile<T>(dataPath);
      if (cachedData === null) {
        throw new Error(`Server returned 304 for ${cacheKey} but cache file is missing`);
      }

      return { data: cachedData, fromCache: true };
    }

    if (!response.ok) {
      throw new Error(`Request failed for ${cacheKey} (HTTP ${String(response.status)})`);
    }

    const data = (await response.json()) as T;
    await mkdir(dirname(dataPath), { recursive: true });
    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');

    const etag = response.headers.get('etag');
    if (etag && etag.trim().length > 0) {
      await writeFile(etagPath, `${etag.trim()}\n`, 'utf-8');
    }

    return { data, fromCache: false };
  } catch (error) {
    const hasDataCache = await fileExists(dataPath);
    if (hasDataCache) {
      const cachedData = await readJsonFile<T>(dataPath);
      if (cachedData !== null) {
        ui.warn('Using cached registry data because the network request failed.');
        return { data: cachedData, fromCache: true };
      }
    }

    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to fetch ${cacheKey}: ${reason}`);
  }
}
