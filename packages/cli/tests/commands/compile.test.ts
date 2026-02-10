import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executePipeline } from '../../src/commands/compile.js';

const VALID_CONFIG = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
  - cursor
mode: copy
blocks: []
`;

const VALID_RULES = `scope: conventions
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
  - id: no-barrel
    severity: warning
    content: Avoid barrel files.
`;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function setupProject(tmpDir: string, config?: string, rules?: string): Promise<void> {
  await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
  await writeFile(join(tmpDir, '.dwf', 'config.yml'), config ?? VALID_CONFIG);
  if (rules !== undefined) {
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), rules);
  }
}

describe('executePipeline', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-compile-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns success results for all configured bridges', async () => {
    await setupProject(tmpDir, VALID_CONFIG, VALID_RULES);

    const result = await executePipeline({ cwd: tmpDir });

    assert.ok(result.results.length > 0);
    assert.equal(result.activeRuleCount, 2);
    assert.ok(result.elapsedMs > 0);

    const claudeResult = result.results.find((r) => r.bridgeId === 'claude');
    assert.ok(claudeResult);
    assert.equal(claudeResult.success, true);
    assert.ok(await fileExists(join(tmpDir, 'CLAUDE.md')));

    const cursorResult = result.results.find((r) => r.bridgeId === 'cursor');
    assert.ok(cursorResult);
    assert.equal(cursorResult.success, true);
  });

  it('tool option filters to single bridge', async () => {
    await setupProject(tmpDir, VALID_CONFIG, VALID_RULES);

    const result = await executePipeline({ cwd: tmpDir, tool: 'claude' });

    const bridgeIds = new Set(result.results.map((r) => r.bridgeId));
    assert.equal(bridgeIds.size, 1);
    assert.ok(bridgeIds.has('claude'));
  });

  it('throws on invalid tool filter', async () => {
    await setupProject(tmpDir, VALID_CONFIG, VALID_RULES);

    await assert.rejects(
      () => executePipeline({ cwd: tmpDir, tool: 'noexiste' }),
      (err: Error) => {
        assert.ok(err.message.includes('not configured'));
        return true;
      }
    );
  });

  it('throws on missing config', async () => {
    await assert.rejects(
      () => executePipeline({ cwd: tmpDir }),
      (err: Error) => {
        assert.ok(err.message.length > 0);
        return true;
      }
    );
  });

  it('throws on invalid YAML syntax', async () => {
    await mkdir(join(tmpDir, '.dwf'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), ':\ninvalid: [yaml: {broken');

    await assert.rejects(
      () => executePipeline({ cwd: tmpDir })
    );
  });

  it('write: false returns content without writing files', async () => {
    await setupProject(tmpDir, VALID_CONFIG, VALID_RULES);

    const result = await executePipeline({ cwd: tmpDir, tool: 'claude', write: false });

    const claudeResult = result.results.find((r) => r.bridgeId === 'claude');
    assert.ok(claudeResult);
    assert.equal(claudeResult.success, true);
    assert.ok(claudeResult.content);
    assert.ok(claudeResult.content.includes('named exports'));

    assert.ok(!(await fileExists(join(tmpDir, 'CLAUDE.md'))));
  });

  it('writes hash file on successful compile', async () => {
    await setupProject(tmpDir, VALID_CONFIG, VALID_RULES);

    await executePipeline({ cwd: tmpDir });

    const hashPath = join(tmpDir, '.dwf', '.cache', 'rules.hash');
    assert.ok(await fileExists(hashPath));
    const hash = await readFile(hashPath, 'utf-8');
    assert.ok(hash.length > 0);
  });

  it('does not write hash when write is false', async () => {
    await setupProject(tmpDir, VALID_CONFIG, VALID_RULES);

    await executePipeline({ cwd: tmpDir, write: false });

    const hashPath = join(tmpDir, '.dwf', '.cache', 'rules.hash');
    assert.ok(!(await fileExists(hashPath)));
  });
});
