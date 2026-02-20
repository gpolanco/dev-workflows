import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deepMerge, mergeSettingsFile } from '../../src/core/settings-merge.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'settings-merge-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    assert.deepEqual(result, { a: 1, b: 3, c: 4 });
  });

  it('concatenates arrays', () => {
    const result = deepMerge({ items: [1, 2] }, { items: [3, 4] });
    assert.deepEqual(result, { items: [1, 2, 3, 4] });
  });

  it('recursively merges nested objects', () => {
    const target = { hooks: { PreToolUse: [{ matcher: 'Read' }] } };
    const source = { hooks: { PostToolUse: [{ matcher: 'Write' }] } };
    const result = deepMerge(target, source);
    assert.deepEqual(result, {
      hooks: {
        PreToolUse: [{ matcher: 'Read' }],
        PostToolUse: [{ matcher: 'Write' }],
      },
    });
  });

  it('overwrites primitives', () => {
    const result = deepMerge({ name: 'old' }, { name: 'new' });
    assert.equal(result.name, 'new');
  });

  it('handles source overwriting array with non-array', () => {
    const result = deepMerge({ items: [1, 2] }, { items: 'replaced' });
    assert.equal(result.items, 'replaced');
  });

  it('preserves keys not in source', () => {
    const result = deepMerge({ a: 1, b: 2 }, { c: 3 });
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
    assert.equal(result.c, 3);
  });
});

describe('mergeSettingsFile', () => {
  it('creates settings file when none exists', async () => {
    await mergeSettingsFile(tmpDir, {
      hooks: { PostToolUse: [{ matcher: 'Write', command: 'fmt' }] },
    });

    const content = JSON.parse(
      await readFile(join(tmpDir, '.claude', 'settings.local.json'), 'utf-8'),
    );
    assert.ok(Array.isArray(content.hooks.PostToolUse));
  });

  it('merges with existing settings', async () => {
    const settingsDir = join(tmpDir, '.claude');
    await mkdir(settingsDir, { recursive: true });
    await writeFile(
      join(settingsDir, 'settings.local.json'),
      JSON.stringify({ existing: true, hooks: { PreToolUse: [{ matcher: 'Read' }] } }),
    );

    await mergeSettingsFile(tmpDir, {
      hooks: { PostToolUse: [{ matcher: 'Write', command: 'fmt' }] },
    });

    const content = JSON.parse(
      await readFile(join(settingsDir, 'settings.local.json'), 'utf-8'),
    );
    assert.equal(content.existing, true);
    assert.ok(Array.isArray(content.hooks.PreToolUse));
    assert.ok(Array.isArray(content.hooks.PostToolUse));
  });

  it('handles corrupted existing file', async () => {
    const settingsDir = join(tmpDir, '.claude');
    await mkdir(settingsDir, { recursive: true });
    await writeFile(join(settingsDir, 'settings.local.json'), 'not json{{{');

    await mergeSettingsFile(tmpDir, { key: 'value' });

    const content = JSON.parse(
      await readFile(join(settingsDir, 'settings.local.json'), 'utf-8'),
    );
    assert.equal(content.key, 'value');
  });
});
