import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scopeToFilename, cleanStaleFiles } from '../../src/core/scope-filename.js';

describe('scopeToFilename', () => {
  it('converts built-in scope "conventions"', () => {
    const result = scopeToFilename('conventions', 'dwf-', '.md');
    assert.equal(result, 'dwf-conventions.md');
  });

  it('converts built-in scope "security"', () => {
    const result = scopeToFilename('security', 'dwf-', '.md');
    assert.equal(result, 'dwf-security.md');
  });

  it('converts built-in scope "testing"', () => {
    const result = scopeToFilename('testing', 'dwf-', '.mdc');
    assert.equal(result, 'dwf-testing.mdc');
  });

  it('converts built-in scope "architecture"', () => {
    const result = scopeToFilename('architecture', 'dwf-', '.md');
    assert.equal(result, 'dwf-architecture.md');
  });

  it('converts built-in scope "workflow"', () => {
    const result = scopeToFilename('workflow', 'dwf-', '.md');
    assert.equal(result, 'dwf-workflow.md');
  });

  it('replaces single colon in custom scope', () => {
    const result = scopeToFilename('team:payments', 'dwf-', '.md');
    assert.equal(result, 'dwf-team-payments.md');
  });

  it('replaces multiple colons in custom scope', () => {
    const result = scopeToFilename('team:payments:billing', 'dwf-', '.md');
    assert.equal(result, 'dwf-team-payments-billing.md');
  });

  it('works with .mdc extension for cursor', () => {
    const result = scopeToFilename('team:payments', 'dwf-', '.mdc');
    assert.equal(result, 'dwf-team-payments.mdc');
  });

  it('works with .instructions.md extension', () => {
    const result = scopeToFilename('security', 'dwf-', '.instructions.md');
    assert.equal(result, 'dwf-security.instructions.md');
  });

  it('handles scope with no colon', () => {
    const result = scopeToFilename('conventions', 'dwf-', '.md');
    assert.equal(result, 'dwf-conventions.md');
  });
});

describe('cleanStaleFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-stale-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('removes orphaned files with matching prefix and extension', async () => {
    await writeFile(join(tmpDir, 'dwf-conventions.md'), 'content');
    await writeFile(join(tmpDir, 'dwf-security.md'), 'content');
    await writeFile(join(tmpDir, 'dwf-testing.md'), 'content');

    const currentFiles = new Set(['dwf-conventions.md', 'dwf-security.md']);
    const deleted = await cleanStaleFiles(tmpDir, 'dwf-', '.md', currentFiles);

    assert.deepEqual(deleted, ['dwf-testing.md']);

    const remaining = await readdir(tmpDir);
    assert.ok(remaining.includes('dwf-conventions.md'));
    assert.ok(remaining.includes('dwf-security.md'));
    assert.ok(!remaining.includes('dwf-testing.md'));
  });

  it('preserves current files', async () => {
    await writeFile(join(tmpDir, 'dwf-conventions.md'), 'content');
    await writeFile(join(tmpDir, 'dwf-security.md'), 'content');

    const currentFiles = new Set(['dwf-conventions.md', 'dwf-security.md']);
    const deleted = await cleanStaleFiles(tmpDir, 'dwf-', '.md', currentFiles);

    assert.deepEqual(deleted, []);

    const remaining = await readdir(tmpDir);
    assert.equal(remaining.length, 2);
  });

  it('ignores non-matching files (no prefix match)', async () => {
    await writeFile(join(tmpDir, 'dwf-conventions.md'), 'content');
    await writeFile(join(tmpDir, 'my-custom-rule.md'), 'user content');
    await writeFile(join(tmpDir, 'README.md'), 'readme');

    const currentFiles = new Set(['dwf-conventions.md']);
    const deleted = await cleanStaleFiles(tmpDir, 'dwf-', '.md', currentFiles);

    assert.deepEqual(deleted, []);

    const remaining = await readdir(tmpDir);
    assert.ok(remaining.includes('my-custom-rule.md'));
    assert.ok(remaining.includes('README.md'));
    assert.ok(remaining.includes('dwf-conventions.md'));
  });

  it('ignores files with wrong extension', async () => {
    await writeFile(join(tmpDir, 'dwf-conventions.md'), 'content');
    await writeFile(join(tmpDir, 'dwf-conventions.mdc'), 'cursor content');

    const currentFiles = new Set(['dwf-conventions.md']);
    const deleted = await cleanStaleFiles(tmpDir, 'dwf-', '.md', currentFiles);

    assert.deepEqual(deleted, []);

    const remaining = await readdir(tmpDir);
    assert.ok(remaining.includes('dwf-conventions.mdc'));
  });

  it('returns empty array for non-existent directory', async () => {
    const nonExistent = join(tmpDir, 'does-not-exist');
    const deleted = await cleanStaleFiles(nonExistent, 'dwf-', '.md', new Set());

    assert.deepEqual(deleted, []);
  });

  it('removes all stale files when currentFiles is empty', async () => {
    await writeFile(join(tmpDir, 'dwf-conventions.md'), 'content');
    await writeFile(join(tmpDir, 'dwf-security.md'), 'content');

    const deleted = await cleanStaleFiles(tmpDir, 'dwf-', '.md', new Set());

    assert.equal(deleted.length, 2);
    assert.ok(deleted.includes('dwf-conventions.md'));
    assert.ok(deleted.includes('dwf-security.md'));

    const remaining = await readdir(tmpDir);
    assert.equal(remaining.length, 0);
  });
});
