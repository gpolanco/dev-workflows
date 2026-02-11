import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { set, getFromDisk } from '../../src/utils/cache.js';

describe('cache', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dwf-cache-test-'));
    // Create .dwf directory structure
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(tempDir, '.dwf', '.cache'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('set + get returns stored value', async () => {
    await set(tempDir, 'test-key', { foo: 'bar' });
    const result = await getFromDisk<{ foo: string }>(tempDir, 'test-key');
    assert.deepEqual(result, { foo: 'bar' });
  });

  it('get returns null on cache miss', async () => {
    const result = await getFromDisk<string>(tempDir, 'nonexistent');
    assert.equal(result, null);
  });

  it('get returns null when cache file does not exist', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'dwf-cache-empty-'));
    const result = await getFromDisk<string>(emptyDir, 'key');
    assert.equal(result, null);
    await rm(emptyDir, { recursive: true, force: true });
  });

  it('handles corrupted cache file gracefully', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(tempDir, '.dwf', '.cache', 'registry.json'), 'not json!!!', 'utf-8');
    const result = await getFromDisk<string>(tempDir, 'key');
    assert.equal(result, null);
  });

  it('overwrites existing key', async () => {
    await set(tempDir, 'key', 'first');
    await set(tempDir, 'key', 'second');
    const result = await getFromDisk<string>(tempDir, 'key');
    assert.equal(result, 'second');
  });

  it('stores multiple keys independently', async () => {
    await set(tempDir, 'a', 1);
    await set(tempDir, 'b', 2);
    const a = await getFromDisk<number>(tempDir, 'a');
    const b = await getFromDisk<number>(tempDir, 'b');
    assert.equal(a, 1);
    assert.equal(b, 2);
  });
});
