import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkConfigExists,
  checkConfigValid,
  checkRulesValid,
  checkDuplicateIds,
  checkScopeFormat,
  checkBridgesAvailable,
  checkSymlinks,
  checkHashSync,
} from '../../src/commands/doctor.js';
import { computeRulesHash, writeHash } from '../../src/core/hash.js';
import type { Rule, ProjectConfig } from '../../src/bridges/types.js';

const VALID_CONFIG = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
  - cursor
mode: copy
blocks: []
`;

const VALID_RULES = `scope: architecture
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
  - id: no-barrel
    severity: warning
    content: Avoid barrel files.
`;

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'test-rule',
    scope: 'architecture',
    severity: 'error',
    content: 'Test content',
    enabled: true,
    ...overrides,
  };
}

describe('doctor checks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-doctor-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('checkConfigExists', () => {
    it('passes when .dwf/config.yml exists', async () => {
      await mkdir(join(tmpDir, '.dwf'), { recursive: true });
      await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG);

      const result = await checkConfigExists(tmpDir);
      assert.equal(result.passed, true);
    });

    it('fails when .dwf/config.yml is missing', async () => {
      const result = await checkConfigExists(tmpDir);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('not found'));
    });
  });

  describe('checkConfigValid', () => {
    it('passes with valid config', async () => {
      await mkdir(join(tmpDir, '.dwf'), { recursive: true });
      await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG);

      const result = await checkConfigValid(tmpDir);
      assert.equal(result.passed, true);
    });

    it('fails with invalid config', async () => {
      await mkdir(join(tmpDir, '.dwf'), { recursive: true });
      await writeFile(join(tmpDir, '.dwf', 'config.yml'), 'not: valid: yaml: config');

      const result = await checkConfigValid(tmpDir);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('invalid'));
    });

    it('fails when tools is not an array', async () => {
      await mkdir(join(tmpDir, '.dwf'), { recursive: true });
      await writeFile(join(tmpDir, '.dwf', 'config.yml'), `version: "0.1"
project:
  name: test
tools: "claude"
mode: copy
blocks: []
`);

      const result = await checkConfigValid(tmpDir);
      assert.equal(result.passed, false);
    });
  });

  describe('checkRulesValid', () => {
    it('passes with valid rule files', async () => {
      await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
      await writeFile(join(tmpDir, '.dwf', 'rules', 'arch.yml'), VALID_RULES);

      const result = await checkRulesValid(tmpDir);
      assert.equal(result.passed, true);
      assert.ok(result.message.includes('2 rules'));
    });

    it('passes when no rules directory exists', async () => {
      const result = await checkRulesValid(tmpDir);
      assert.equal(result.passed, true);
      assert.ok(result.message.includes('0 rules'));
    });

    it('fails with invalid YAML in rule file', async () => {
      await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
      await writeFile(join(tmpDir, '.dwf', 'rules', 'bad.yml'), ':\ninvalid: [yaml: {broken');

      const result = await checkRulesValid(tmpDir);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('bad.yml'));
    });
  });

  describe('checkDuplicateIds', () => {
    it('passes with unique IDs', () => {
      const rules = [
        makeRule({ id: 'rule-a' }),
        makeRule({ id: 'rule-b' }),
        makeRule({ id: 'rule-c' }),
      ];

      const result = checkDuplicateIds(rules);
      assert.equal(result.passed, true);
    });

    it('fails with duplicate IDs and shows scopes', () => {
      const rules = [
        makeRule({ id: 'named-exports', scope: 'architecture' }),
        makeRule({ id: 'no-barrel', scope: 'architecture' }),
        makeRule({ id: 'named-exports', scope: 'conventions' }),
      ];

      const result = checkDuplicateIds(rules);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('named-exports'));
      assert.ok(result.message.includes('architecture'));
      assert.ok(result.message.includes('conventions'));
    });

    it('passes with empty rules', () => {
      const result = checkDuplicateIds([]);
      assert.equal(result.passed, true);
    });
  });

  describe('checkScopeFormat', () => {
    it('passes with valid built-in scopes', () => {
      const rules = [
        makeRule({ id: 'a', scope: 'architecture' }),
        makeRule({ id: 'b', scope: 'conventions' }),
        makeRule({ id: 'c', scope: 'security' }),
      ];
      const result = checkScopeFormat(rules);
      assert.equal(result.passed, true);
    });

    it('passes with valid custom scopes', () => {
      const rules = [
        makeRule({ id: 'a', scope: 'team:payments' }),
        makeRule({ id: 'b', scope: 'agent:reviewer' }),
        makeRule({ id: 'c', scope: 'pipeline:ci' }),
      ];
      const result = checkScopeFormat(rules);
      assert.equal(result.passed, true);
    });

    it('fails with invalid scope format', () => {
      const rules = [
        makeRule({ id: 'a', scope: 'architecture' }),
        makeRule({ id: 'b', scope: 'Team:payments' }),
        makeRule({ id: 'c', scope: ':bad' }),
      ];
      const result = checkScopeFormat(rules);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('Team:payments'));
      assert.ok(result.message.includes(':bad'));
    });

    it('passes with empty rules', () => {
      const result = checkScopeFormat([]);
      assert.equal(result.passed, true);
    });
  });

  describe('checkBridgesAvailable', () => {
    it('passes when all tools have bridges', () => {
      const config: ProjectConfig = {
        version: '0.1',
        project: { name: 'test' },
        tools: ['claude', 'cursor', 'gemini'],
        mode: 'copy',
        blocks: [],
      };

      const result = checkBridgesAvailable(config);
      assert.equal(result.passed, true);
    });

    it('passes with windsurf and copilot', () => {
      const config: ProjectConfig = {
        version: '0.1',
        project: { name: 'test' },
        tools: ['claude', 'windsurf', 'copilot'],
        mode: 'copy',
        blocks: [],
      };

      const result = checkBridgesAvailable(config);
      assert.equal(result.passed, true);
    });

    it('fails when a tool has no bridge', () => {
      const config: ProjectConfig = {
        version: '0.1',
        project: { name: 'test' },
        tools: ['claude', 'vscode'],
        mode: 'copy',
        blocks: [],
      };

      const result = checkBridgesAvailable(config);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('vscode'));
    });
  });

  describe('checkSymlinks', () => {
    it('skips when mode is copy', async () => {
      const config: ProjectConfig = {
        version: '0.1',
        project: { name: 'test' },
        tools: ['claude'],
        mode: 'copy',
        blocks: [],
      };

      const result = await checkSymlinks(tmpDir, config);
      assert.equal(result.passed, true);
      assert.equal(result.skipped, true);
    });

    it('passes when symlinks are valid', async () => {
      const config: ProjectConfig = {
        version: '0.1',
        project: { name: 'test' },
        tools: ['claude'],
        mode: 'link',
        blocks: [],
      };

      // Create a target file and a symlink pointing to it
      const targetPath = join(tmpDir, '.dwf', '.cache', 'CLAUDE.md');
      await mkdir(join(tmpDir, '.dwf', '.cache'), { recursive: true });
      await writeFile(targetPath, 'content');
      await symlink(targetPath, join(tmpDir, 'CLAUDE.md'));

      const result = await checkSymlinks(tmpDir, config);
      assert.equal(result.passed, true);
      assert.equal(result.skipped, undefined);
    });

    it('fails when symlinks are broken', async () => {
      const config: ProjectConfig = {
        version: '0.1',
        project: { name: 'test' },
        tools: ['claude'],
        mode: 'link',
        blocks: [],
      };

      // Create a symlink pointing to a non-existent target
      const brokenTarget = join(tmpDir, '.dwf', '.cache', 'CLAUDE.md');
      await symlink(brokenTarget, join(tmpDir, 'CLAUDE.md'));

      const result = await checkSymlinks(tmpDir, config);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('CLAUDE.md'));
    });
  });

  describe('checkHashSync', () => {
    it('skips when no stored hash exists', async () => {
      const rules = [makeRule()];
      const result = await checkHashSync(tmpDir, rules);
      assert.equal(result.passed, true);
      assert.equal(result.skipped, true);
    });

    it('passes when hash matches', async () => {
      const rules = [makeRule({ id: 'rule-a' }), makeRule({ id: 'rule-b' })];
      const hash = computeRulesHash(rules);
      await writeHash(tmpDir, hash);

      const result = await checkHashSync(tmpDir, rules);
      assert.equal(result.passed, true);
      assert.ok(result.message.includes('in sync'));
    });

    it('fails when hash does not match', async () => {
      const rules = [makeRule({ id: 'rule-a' })];
      await writeHash(tmpDir, 'stale-hash-value');

      const result = await checkHashSync(tmpDir, rules);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('out of sync'));
    });
  });
});

describe('computeRulesHash', () => {
  it('produces consistent hash for same rules', () => {
    const rules = [makeRule({ id: 'a' }), makeRule({ id: 'b' })];
    const hash1 = computeRulesHash(rules);
    const hash2 = computeRulesHash(rules);
    assert.equal(hash1, hash2);
  });

  it('produces same hash regardless of input order', () => {
    const ruleA = makeRule({ id: 'a', content: 'content a' });
    const ruleB = makeRule({ id: 'b', content: 'content b' });

    const hash1 = computeRulesHash([ruleA, ruleB]);
    const hash2 = computeRulesHash([ruleB, ruleA]);
    assert.equal(hash1, hash2);
  });

  it('produces different hash when rules change', () => {
    const rules1 = [makeRule({ id: 'a', content: 'original' })];
    const rules2 = [makeRule({ id: 'a', content: 'modified' })];

    const hash1 = computeRulesHash(rules1);
    const hash2 = computeRulesHash(rules2);
    assert.notEqual(hash1, hash2);
  });
});
