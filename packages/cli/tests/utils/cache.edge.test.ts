import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { get, set, getFromDisk, fetchWithETag } from '../../src/utils/cache.js';

describe('cache edge cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dwf-cache-edge-'));
    await mkdir(join(tempDir, '.dwf', '.cache'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('TTL expiration', () => {
    it('get() returns null when entry timestamp is expired (>1h)', () => {
      const store = {
        'old-key': {
          data: 'stale value',
          timestamp: Date.now() - 3_700_000, // > 1 hour ago
        },
      };

      const result = get<string>(tempDir, 'old-key', store);
      assert.equal(result, null);
    });

    it('getFromDisk returns null when disk entry is expired', async () => {
      const store = {
        'expired-key': {
          data: { foo: 'bar' },
          timestamp: Date.now() - 4_000_000, // expired
        },
      };
      await writeFile(
        join(tempDir, '.dwf', '.cache', 'registry-store.json'),
        JSON.stringify(store),
        'utf-8',
      );

      const result = await getFromDisk<{ foo: string }>(tempDir, 'expired-key');
      assert.equal(result, null);
    });
  });

  describe('malformed store', () => {
    it('readStore returns {} when cache file is a JSON array', async () => {
      await writeFile(
        join(tempDir, '.dwf', '.cache', 'registry-store.json'),
        JSON.stringify([1, 2, 3]),
        'utf-8',
      );

      const result = await getFromDisk<string>(tempDir, 'any-key');
      assert.equal(result, null);
    });
  });

  describe('directory creation', () => {
    it('set() creates .dwf/.cache/ directory if it does not exist', async () => {
      const freshDir = await mkdtemp(join(tmpdir(), 'dwf-cache-fresh-'));
      // No .dwf/.cache directory exists

      await set(freshDir, 'new-key', 'new-value');

      const result = await getFromDisk<string>(freshDir, 'new-key');
      assert.equal(result, 'new-value');

      await rm(freshDir, { recursive: true, force: true });
    });
  });

  describe('timestamp correctness', () => {
    it('stored timestamp is within expected range', async () => {
      const before = Date.now();
      await set(tempDir, 'ts-key', 'value');
      const after = Date.now();

      const raw = await readFile(
        join(tempDir, '.dwf', '.cache', 'registry-store.json'),
        'utf-8',
      );
      const store = JSON.parse(raw) as Record<string, { timestamp: number }>;
      const entry = store['ts-key'];
      assert.ok(entry);
      assert.ok(entry.timestamp >= before, `timestamp ${String(entry.timestamp)} should be >= ${String(before)}`);
      assert.ok(entry.timestamp <= after, `timestamp ${String(entry.timestamp)} should be <= ${String(after)}`);
    });
  });

  describe('empty store', () => {
    it('get() with empty store returns null', () => {
      const result = get<string>(tempDir, 'missing', {});
      assert.equal(result, null);
    });
  });

  describe('fetchWithETag', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('writes cache and etag on 200 response', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ version: 1 }), {
          status: 200,
          headers: {
            etag: 'W/"abc123"',
            'content-type': 'application/json',
          },
        });

      const cacheDir = join(tempDir, '.dwf', '.cache');
      const result = await fetchWithETag<{ version: number }>('https://example.com/registry.json', cacheDir, 'registry');

      assert.equal(result.fromCache, false);
      assert.deepEqual(result.data, { version: 1 });

      const dataRaw = await readFile(join(cacheDir, 'registry.json'), 'utf-8');
      const etagRaw = await readFile(join(cacheDir, 'registry.etag'), 'utf-8');
      assert.deepEqual(JSON.parse(dataRaw), { version: 1 });
      assert.equal(etagRaw.trim(), 'W/"abc123"');
    });

    it('uses local cache when server returns 304', async () => {
      const cacheDir = join(tempDir, '.dwf', '.cache');
      await writeFile(join(cacheDir, 'registry.json'), JSON.stringify({ cached: true }), 'utf-8');
      await writeFile(join(cacheDir, 'registry.etag'), 'W/"etag-a"\n', 'utf-8');

      globalThis.fetch = async (_url, init) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        assert.equal(headers['If-None-Match'], 'W/"etag-a"');
        return new Response(null, { status: 304 });
      };

      const result = await fetchWithETag<{ cached: boolean }>('https://example.com/registry.json', cacheDir, 'registry');
      assert.equal(result.fromCache, true);
      assert.deepEqual(result.data, { cached: true });
    });

    it('falls back to cache when network fails', async () => {
      const cacheDir = join(tempDir, '.dwf', '.cache');
      await writeFile(join(cacheDir, 'registry.json'), JSON.stringify({ offline: true }), 'utf-8');

      globalThis.fetch = async () => {
        throw new Error('network down');
      };

      const result = await fetchWithETag<{ offline: boolean }>('https://example.com/registry.json', cacheDir, 'registry');
      assert.equal(result.fromCache, true);
      assert.deepEqual(result.data, { offline: true });
    });

    it('throws clear error when no cache and request fails', async () => {
      const cacheDir = join(tempDir, '.dwf', '.cache');

      globalThis.fetch = async () => {
        throw new Error('network down');
      };

      await assert.rejects(
        () => fetchWithETag('https://example.com/registry.json', cacheDir, 'registry'),
        (error: Error) => {
          assert.match(error.message, /Unable to fetch registry/);
          return true;
        },
      );
    });
  });
});
