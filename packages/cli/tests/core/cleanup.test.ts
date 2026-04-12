import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectLegacyFiles,
  migrateLegacyFiles,
  removeLegacyMarkerBlock,
} from '../../src/core/cleanup.js';
import type { LegacyFile } from '../../src/core/cleanup.js';

describe('detectLegacyFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-cleanup-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('detects legacy .cursor/rules/devworkflows.mdc', async () => {
    await mkdir(join(tmpDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'), 'old cursor content');

    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 1);
    assert.equal(legacy[0]?.type, 'full-file');
    assert.equal(legacy[0]?.bridgeId, 'cursor');
  });

  it('detects legacy .windsurf/rules/devworkflows.md', async () => {
    await mkdir(join(tmpDir, '.windsurf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.windsurf', 'rules', 'devworkflows.md'), 'old windsurf content');

    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 1);
    assert.equal(legacy[0]?.type, 'full-file');
    assert.equal(legacy[0]?.bridgeId, 'windsurf');
  });

  it('detects CLAUDE.md with dev-workflows markers', async () => {
    const claudeContent = [
      '# My Notes',
      '',
      '<!-- BEGIN dev-workflows -->',
      '# Project Rules',
      '<!-- END dev-workflows -->',
      '',
      '# Other stuff',
    ].join('\n');
    await writeFile(join(tmpDir, 'CLAUDE.md'), claudeContent);

    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 1);
    assert.equal(legacy[0]?.type, 'marker');
    assert.equal(legacy[0]?.bridgeId, 'claude');
  });

  it('does NOT detect CLAUDE.md without markers', async () => {
    await writeFile(join(tmpDir, 'CLAUDE.md'), '# Just a normal CLAUDE.md');

    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 0);
  });

  it('does NOT detect GEMINI.md as legacy', async () => {
    const geminiContent = [
      '<!-- BEGIN dev-workflows -->',
      '# Rules',
      '<!-- END dev-workflows -->',
    ].join('\n');
    await writeFile(join(tmpDir, 'GEMINI.md'), geminiContent);

    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 0);
  });

  it('does NOT detect .github/copilot-instructions.md as legacy', async () => {
    await mkdir(join(tmpDir, '.github'), { recursive: true });
    const copilotContent = [
      '<!-- BEGIN dev-workflows -->',
      '# Rules',
      '<!-- END dev-workflows -->',
    ].join('\n');
    await writeFile(join(tmpDir, '.github', 'copilot-instructions.md'), copilotContent);

    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 0);
  });

  it('detects multiple legacy files at once', async () => {
    await mkdir(join(tmpDir, '.cursor', 'rules'), { recursive: true });
    await mkdir(join(tmpDir, '.windsurf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'), 'cursor');
    await writeFile(join(tmpDir, '.windsurf', 'rules', 'devworkflows.md'), 'windsurf');
    await writeFile(
      join(tmpDir, 'CLAUDE.md'),
      '<!-- BEGIN dev-workflows -->\n# Rules\n<!-- END dev-workflows -->',
    );

    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 3);
    const bridgeIds = legacy.map((l) => l.bridgeId).sort();
    assert.deepEqual(bridgeIds, ['claude', 'cursor', 'windsurf']);
  });

  it('returns empty array when no legacy files exist', async () => {
    const legacy = await detectLegacyFiles(tmpDir);

    assert.equal(legacy.length, 0);
  });
});

describe('migrateLegacyFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-migrate-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('deletes full-file legacy files', async () => {
    await mkdir(join(tmpDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'), 'old content');

    const legacyFiles: LegacyFile[] = [{
      path: join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'),
      type: 'full-file',
      bridgeId: 'cursor',
    }];

    const actions = await migrateLegacyFiles(tmpDir, legacyFiles);

    assert.equal(actions.length, 1);
    assert.ok(actions[0]?.includes('Removed legacy'));

    const remaining = await readdir(join(tmpDir, '.cursor', 'rules'));
    assert.equal(remaining.length, 0);
  });

  it('removes marker block from CLAUDE.md preserving manual content', async () => {
    const claudeContent = [
      '# My Custom Notes',
      '',
      '<!-- BEGIN dev-workflows -->',
      '# Project Rules',
      '',
      '## Architecture',
      '',
      '- Use named exports.',
      '<!-- END dev-workflows -->',
      '',
      '# Other important stuff',
    ].join('\n');
    await writeFile(join(tmpDir, 'CLAUDE.md'), claudeContent);

    const legacyFiles: LegacyFile[] = [{
      path: join(tmpDir, 'CLAUDE.md'),
      type: 'marker',
      bridgeId: 'claude',
    }];

    const actions = await migrateLegacyFiles(tmpDir, legacyFiles);

    assert.equal(actions.length, 1);
    assert.ok(actions[0]?.includes('Removed devw block'));

    const content = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('# My Custom Notes'));
    assert.ok(content.includes('# Other important stuff'));
    assert.ok(!content.includes('BEGIN dev-workflows'));
    assert.ok(!content.includes('END dev-workflows'));
    assert.ok(!content.includes('Use named exports'));
  });

  it('deletes CLAUDE.md if it becomes empty after marker removal', async () => {
    const claudeContent = [
      '<!-- BEGIN dev-workflows -->',
      '# Project Rules',
      '<!-- END dev-workflows -->',
    ].join('\n');
    await writeFile(join(tmpDir, 'CLAUDE.md'), claudeContent);

    const legacyFiles: LegacyFile[] = [{
      path: join(tmpDir, 'CLAUDE.md'),
      type: 'marker',
      bridgeId: 'claude',
    }];

    const actions = await migrateLegacyFiles(tmpDir, legacyFiles);

    assert.equal(actions.length, 1);

    const entries = await readdir(tmpDir);
    assert.ok(!entries.includes('CLAUDE.md'));
  });

  it('is idempotent — skips files that do not exist', async () => {
    const legacyFiles: LegacyFile[] = [{
      path: join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'),
      type: 'full-file',
      bridgeId: 'cursor',
    }];

    const actions = await migrateLegacyFiles(tmpDir, legacyFiles);

    assert.equal(actions.length, 0);
  });

  it('handles mixed legacy file types', async () => {
    await mkdir(join(tmpDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'), 'old cursor');
    await writeFile(
      join(tmpDir, 'CLAUDE.md'),
      '# Notes\n\n<!-- BEGIN dev-workflows -->\nRules\n<!-- END dev-workflows -->\n\n# More',
    );

    const legacyFiles: LegacyFile[] = [
      {
        path: join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'),
        type: 'full-file',
        bridgeId: 'cursor',
      },
      {
        path: join(tmpDir, 'CLAUDE.md'),
        type: 'marker',
        bridgeId: 'claude',
      },
    ];

    const actions = await migrateLegacyFiles(tmpDir, legacyFiles);

    assert.equal(actions.length, 2);
  });
});

describe('removeLegacyMarkerBlock', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-marker-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('removes marker block and preserves surrounding content', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '# Before\n\n<!-- BEGIN dev-workflows -->\nRules\n<!-- END dev-workflows -->\n\n# After');

    const result = await removeLegacyMarkerBlock(filePath);

    assert.equal(result, true);
    const content = await readFile(filePath, 'utf-8');
    assert.ok(content.includes('# Before'));
    assert.ok(content.includes('# After'));
    assert.ok(!content.includes('BEGIN dev-workflows'));
  });

  it('returns false if file does not exist', async () => {
    const result = await removeLegacyMarkerBlock(join(tmpDir, 'nonexistent.md'));

    assert.equal(result, false);
  });

  it('returns false if file has no markers', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '# Just normal content');

    const result = await removeLegacyMarkerBlock(filePath);

    assert.equal(result, false);
  });

  it('deletes file if it becomes empty after removal', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '<!-- BEGIN dev-workflows -->\nRules\n<!-- END dev-workflows -->');

    const result = await removeLegacyMarkerBlock(filePath);

    assert.equal(result, true);
    const entries = await readdir(tmpDir);
    assert.ok(!entries.includes('test.md'));
  });
});
