import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir, access } from 'node:fs/promises';
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

const COPILOT_CONFIG = `version: "0.1"
project:
  name: "test-project"
tools:
  - copilot
mode: copy
blocks: []
`;

const MIXED_CONFIG = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
  - copilot
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

const SECURITY_RULES = `scope: security
rules:
  - id: no-eval
    severity: error
    content: Never use eval().
`;

const RULES_WITH_METADATA = `scope: conventions
globs:
  - "**/*.ts"
  - "**/*.tsx"
paths:
  - "src/"
trigger: always
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function setupProject(tmpDir: string, config?: string, ruleFiles?: Record<string, string>): Promise<void> {
  await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
  await writeFile(join(tmpDir, '.dwf', 'config.yml'), config ?? VALID_CONFIG);
  if (ruleFiles) {
    for (const [name, content] of Object.entries(ruleFiles)) {
      await writeFile(join(tmpDir, '.dwf', 'rules', name), content);
    }
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
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir });

    assert.ok(result.results.length > 0);
    assert.equal(result.activeRuleCount, 2);
    assert.ok(result.elapsedMs > 0);

    const claudeResult = result.results.find((r) => r.bridgeId === 'claude');
    assert.ok(claudeResult);
    assert.equal(claudeResult.success, true);
    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md')));

    const cursorResult = result.results.find((r) => r.bridgeId === 'cursor');
    assert.ok(cursorResult);
    assert.equal(cursorResult.success, true);
  });

  it('tool option filters bridge but still includes canonical outputs', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir, tool: 'claude' });

    const bridgeIds = new Set(result.results.map((r) => r.bridgeId));
    assert.equal(bridgeIds.size, 2);
    assert.ok(bridgeIds.has('claude'));
    assert.ok(bridgeIds.has('canonical'));
  });

  it('keeps bridge outputs when canonical write fails', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    await mkdir(join(tmpDir, '.agents', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.agents', 'rules', 'devw'), 'blocking file', 'utf-8');

    const result = await executePipeline({ cwd: tmpDir, tool: 'claude' });

    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md')));
    assert.ok(result.canonicalError);

    const claudeResults = result.results.filter((r) => r.bridgeId === 'claude');
    const canonicalResults = result.results.filter((r) => r.bridgeId === 'canonical');

    assert.ok(claudeResults.every((r) => r.success));
    assert.ok(canonicalResults.length > 0);
    assert.ok(canonicalResults.every((r) => !r.success));
  });

  it('throws on invalid tool filter', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    await assert.rejects(
      () => executePipeline({ cwd: tmpDir, tool: 'noexiste' }),
      (err: Error) => {
        assert.ok(err.message.includes('not configured'));
        return true;
      },
    );
  });

  it('throws on missing config', async () => {
    await assert.rejects(
      () => executePipeline({ cwd: tmpDir }),
      (err: Error) => {
        assert.ok(err.message.length > 0);
        return true;
      },
    );
  });

  it('throws on invalid YAML syntax', async () => {
    await mkdir(join(tmpDir, '.dwf'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), ':\ninvalid: [yaml: {broken');

    await assert.rejects(
      () => executePipeline({ cwd: tmpDir }),
    );
  });

  it('write: false returns content without writing files', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir, tool: 'claude', write: false });

    const claudeResult = result.results.find((r) => r.bridgeId === 'claude');
    assert.ok(claudeResult);
    assert.equal(claudeResult.success, true);
    assert.ok(claudeResult.content);
    assert.ok(claudeResult.content.includes('named exports'));

    assert.ok(!(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md'))));
  });

  it('writes hash file on successful compile', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    await executePipeline({ cwd: tmpDir });

    const hashPath = join(tmpDir, '.dwf', '.cache', 'rules.hash');
    assert.ok(await fileExists(hashPath));
    const hash = await readFile(hashPath, 'utf-8');
    assert.ok(hash.length > 0);
  });

  it('does not write hash when write is false', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    await executePipeline({ cwd: tmpDir, write: false });

    const hashPath = join(tmpDir, '.dwf', '.cache', 'rules.hash');
    assert.ok(!(await fileExists(hashPath)));
  });
});

describe('executePipeline DirectoryBridge multi-file output', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-compile-dir-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('generates multiple files for multiple scopes', async () => {
    await setupProject(tmpDir, VALID_CONFIG, {
      'conventions.yml': VALID_RULES,
      'security.yml': SECURITY_RULES,
    });

    const result = await executePipeline({ cwd: tmpDir, tool: 'claude' });

    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md')));
    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-security.md')));
    assert.ok(await fileExists(join(tmpDir, '.agents', 'rules', 'devw', 'dwf-conventions.md')));
    assert.ok(await fileExists(join(tmpDir, '.agents', 'rules', 'devw', 'dwf-security.md')));

    const claudeResults = result.results.filter((r) => r.bridgeId === 'claude');
    assert.equal(claudeResults.length, 2);
    assert.equal(result.canonicalFileCount, 2);
  });

  it('creates output directories automatically', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    // .claude/rules/ does not exist yet
    assert.ok(!(await fileExists(join(tmpDir, '.claude', 'rules'))));

    await executePipeline({ cwd: tmpDir, tool: 'claude' });

    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md')));
  });

  it('generates correct frontmatter with scope metadata', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': RULES_WITH_METADATA });

    await executePipeline({ cwd: tmpDir, tool: 'claude' });

    const content = await readFile(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md'), 'utf-8');
    assert.ok(content.includes('paths:'));
    assert.ok(content.includes('"src/"'));

    const canonicalContent = await readFile(join(tmpDir, '.agents', 'rules', 'devw', 'dwf-conventions.md'), 'utf-8');
    assert.ok(canonicalContent.startsWith('<!-- Generated by dev-workflows. Do not edit manually. -->'));
    assert.ok(!canonicalContent.startsWith('---'));
    assert.ok(!canonicalContent.includes('paths:'));
  });
});

describe('executePipeline MarkerBridge output', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-compile-marker-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('generates marker-based output for MarkerBridge', async () => {
    await setupProject(tmpDir, COPILOT_CONFIG, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir });

    const copilotResult = result.results.find((r) => r.bridgeId === 'copilot');
    assert.ok(copilotResult);
    assert.equal(copilotResult.success, true);

    const content = await readFile(join(tmpDir, '.github', 'copilot-instructions.md'), 'utf-8');
    assert.ok(content.includes('<!-- BEGIN dev-workflows -->'));
    assert.ok(content.includes('<!-- END dev-workflows -->'));
    assert.ok(content.includes('Always use named exports.'));
  });

  it('preserves existing content outside markers', async () => {
    await setupProject(tmpDir, COPILOT_CONFIG, { 'conventions.yml': VALID_RULES });

    // Pre-populate the file with user content
    await mkdir(join(tmpDir, '.github'), { recursive: true });
    await writeFile(
      join(tmpDir, '.github', 'copilot-instructions.md'),
      '# My Custom Rules\n\nDo not touch this.\n',
      'utf-8',
    );

    await executePipeline({ cwd: tmpDir });

    const content = await readFile(join(tmpDir, '.github', 'copilot-instructions.md'), 'utf-8');
    assert.ok(content.includes('# My Custom Rules'));
    assert.ok(content.includes('Do not touch this.'));
    assert.ok(content.includes('<!-- BEGIN dev-workflows -->'));
  });
});

describe('executePipeline mixed bridges', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-compile-mixed-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('handles both DirectoryBridge and MarkerBridge in same run', async () => {
    await setupProject(tmpDir, MIXED_CONFIG, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir });

    // Claude (DirectoryBridge) should write to .claude/rules/
    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md')));

    // Copilot (MarkerBridge) should write to .github/copilot-instructions.md
    assert.ok(await fileExists(join(tmpDir, '.github', 'copilot-instructions.md')));

    const claudeResults = result.results.filter((r) => r.bridgeId === 'claude');
    const copilotResults = result.results.filter((r) => r.bridgeId === 'copilot');

    assert.ok(claudeResults.length > 0);
    assert.ok(copilotResults.length > 0);
    assert.ok(claudeResults.every((r) => r.success));
    assert.ok(copilotResults.every((r) => r.success));
  });
});

describe('executePipeline stale file cleanup', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-compile-stale-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('removes orphaned dwf- files from previous compile', async () => {
    const claudeOnlyConfig = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

    await setupProject(tmpDir, claudeOnlyConfig, { 'conventions.yml': VALID_RULES });

    // Pre-populate stale file
    await mkdir(join(tmpDir, '.claude', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.claude', 'rules', 'dwf-testing.md'), 'old content');
    await mkdir(join(tmpDir, '.agents', 'rules', 'devw'), { recursive: true });
    await writeFile(join(tmpDir, '.agents', 'rules', 'devw', 'dwf-testing.md'), 'old content');

    const result = await executePipeline({ cwd: tmpDir });

    // New file should exist
    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md')));
    // Stale file should be removed
    assert.ok(!(await fileExists(join(tmpDir, '.claude', 'rules', 'dwf-testing.md'))));
    assert.ok(!(await fileExists(join(tmpDir, '.agents', 'rules', 'devw', 'dwf-testing.md'))));

    // Should report stale files
    assert.ok(result.staleResults.length > 0);
    const claudeStale = result.staleResults.find((s) => s.bridgeId === 'claude');
    assert.ok(claudeStale);
    assert.ok(claudeStale.deleted.includes('dwf-testing.md'));
  });

  it('does not touch non-dwf files', async () => {
    const claudeOnlyConfig = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

    await setupProject(tmpDir, claudeOnlyConfig, { 'conventions.yml': VALID_RULES });

    // Pre-populate a user file
    await mkdir(join(tmpDir, '.claude', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.claude', 'rules', 'my-custom-rule.md'), 'user content');

    await executePipeline({ cwd: tmpDir });

    // User file should still exist
    assert.ok(await fileExists(join(tmpDir, '.claude', 'rules', 'my-custom-rule.md')));
    const userContent = await readFile(join(tmpDir, '.claude', 'rules', 'my-custom-rule.md'), 'utf-8');
    assert.equal(userContent, 'user content');
  });

  it('cleans all dwf- files when no active rules', async () => {
    const claudeOnlyConfig = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

    const disabledRules = `scope: conventions
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
    enabled: false
`;

    await setupProject(tmpDir, claudeOnlyConfig, { 'conventions.yml': disabledRules });

    // Pre-populate old generated files
    await mkdir(join(tmpDir, '.claude', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.claude', 'rules', 'dwf-conventions.md'), 'old content');

    await executePipeline({ cwd: tmpDir });

    // Should be cleaned up
    const remaining = await readdir(join(tmpDir, '.claude', 'rules'));
    assert.ok(!remaining.includes('dwf-conventions.md'));
  });
});

describe('executePipeline legacy migration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-compile-legacy-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('migrates legacy files on first v2 compile', async () => {
    const claudeOnlyConfig = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

    await setupProject(tmpDir, claudeOnlyConfig, { 'conventions.yml': VALID_RULES });

    // Create legacy files
    await mkdir(join(tmpDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'), 'old cursor content');

    const result = await executePipeline({ cwd: tmpDir });

    // Legacy file should be removed
    assert.ok(!(await fileExists(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'))));
    // Migration actions should be reported
    assert.ok(result.migration.actions.length > 0);
  });

  it('removes legacy marker block from CLAUDE.md', async () => {
    const claudeOnlyConfig = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

    await setupProject(tmpDir, claudeOnlyConfig, { 'conventions.yml': VALID_RULES });

    // Create CLAUDE.md with legacy markers
    await writeFile(
      join(tmpDir, 'CLAUDE.md'),
      '# Notes\n\n<!-- BEGIN dev-workflows -->\n# Rules\n<!-- END dev-workflows -->\n\n# More',
      'utf-8',
    );

    const result = await executePipeline({ cwd: tmpDir });

    // CLAUDE.md should still exist but without markers
    const content = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('# Notes'));
    assert.ok(content.includes('# More'));
    assert.ok(!content.includes('BEGIN dev-workflows'));
    assert.ok(result.migration.actions.length > 0);
  });

  it('migration is idempotent when no legacy files exist', async () => {
    const claudeOnlyConfig = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

    await setupProject(tmpDir, claudeOnlyConfig, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir });

    assert.equal(result.migration.actions.length, 0);
  });

  it('does not migrate in dry-run mode', async () => {
    const claudeOnlyConfig = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

    await setupProject(tmpDir, claudeOnlyConfig, { 'conventions.yml': VALID_RULES });

    // Create legacy file
    await mkdir(join(tmpDir, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc'), 'old cursor content');

    const result = await executePipeline({ cwd: tmpDir, write: false });

    // Legacy file should NOT be removed in dry-run
    assert.ok(await fileExists(join(tmpDir, '.cursor', 'rules', 'devworkflows.mdc')));
    assert.equal(result.migration.actions.length, 0);
  });
});

describe('executePipeline dry-run', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-compile-dry-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shows files for DirectoryBridge without writing', async () => {
    await setupProject(tmpDir, VALID_CONFIG, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir, write: false });

    const claudeResults = result.results.filter((r) => r.bridgeId === 'claude');
    const canonicalResults = result.results.filter((r) => r.bridgeId === 'canonical');
    assert.ok(claudeResults.length > 0);
    assert.ok(canonicalResults.length > 0);
    for (const r of claudeResults) {
      assert.ok(r.content);
      assert.ok(r.outputPath.includes('.claude/rules/'));
    }
    for (const r of canonicalResults) {
      assert.ok(r.content);
      assert.ok(r.outputPath.includes('.agents/rules/devw/'));
    }

    // No files should be written
    assert.ok(!(await fileExists(join(tmpDir, '.claude', 'rules'))));
    assert.ok(!(await fileExists(join(tmpDir, '.agents', 'rules', 'devw'))));
  });

  it('shows files for MarkerBridge without writing', async () => {
    await setupProject(tmpDir, COPILOT_CONFIG, { 'conventions.yml': VALID_RULES });

    const result = await executePipeline({ cwd: tmpDir, write: false });

    const copilotResults = result.results.filter((r) => r.bridgeId === 'copilot');
    assert.ok(copilotResults.length > 0);
    for (const r of copilotResults) {
      assert.ok(r.content);
    }

    assert.ok(!(await fileExists(join(tmpDir, '.github', 'copilot-instructions.md'))));
  });
});
