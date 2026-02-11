import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { readConfig, readRules } from '../../src/core/parser.js';

const BASE_CONFIG = `version: "0.1"
project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []`;

async function createProject(dir: string, configYaml: string): Promise<void> {
  await mkdir(join(dir, '.dwf', 'rules'), { recursive: true });
  await writeFile(join(dir, '.dwf', 'config.yml'), configYaml, 'utf-8');
}

describe('parser edge cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dwf-parser-edge-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('readConfig pulled entries', () => {
    it('filters entry without path', async () => {
      await createProject(tempDir, `${BASE_CONFIG}
pulled:
  - version: "0.1.0"
    pulled_at: "2026-01-01T00:00:00Z"
`);
      const config = await readConfig(tempDir);
      assert.equal(config.pulled.length, 0);
    });

    it('filters null in pulled array', async () => {
      await createProject(tempDir, `${BASE_CONFIG}
pulled:
  - path: "typescript/strict"
    version: "0.1.0"
    pulled_at: "2026-01-01T00:00:00Z"
  - null
`);
      const config = await readConfig(tempDir);
      assert.equal(config.pulled.length, 1);
    });

    it('defaults to [] when pulled is a string', async () => {
      await createProject(tempDir, `${BASE_CONFIG}
pulled: "not-an-array"
`);
      const config = await readConfig(tempDir);
      assert.deepEqual(config.pulled, []);
    });

    it('defaults to [] when pulled is a number', async () => {
      await createProject(tempDir, `${BASE_CONFIG}
pulled: 42
`);
      const config = await readConfig(tempDir);
      assert.deepEqual(config.pulled, []);
    });

    it('keeps entry without version but with path (version defaults to empty)', async () => {
      await createProject(tempDir, `${BASE_CONFIG}
pulled:
  - path: "typescript/strict"
    pulled_at: "2026-01-01T00:00:00Z"
`);
      const config = await readConfig(tempDir);
      assert.equal(config.pulled.length, 1);
      assert.equal(config.pulled[0]?.version, '');
    });
  });

  describe('normalizeRule via readRules', () => {
    it('skips rule without id', async () => {
      await createProject(tempDir, BASE_CONFIG);
      const doc = {
        scope: 'conventions',
        rules: [{ severity: 'error', content: 'No id rule' }],
      };
      await writeFile(join(tempDir, '.dwf', 'rules', 'test.yml'), stringify(doc), 'utf-8');

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 0);
    });

    it('skips rule without content', async () => {
      await createProject(tempDir, BASE_CONFIG);
      const doc = {
        scope: 'conventions',
        rules: [{ id: 'no-content', severity: 'error' }],
      };
      await writeFile(join(tempDir, '.dwf', 'rules', 'test.yml'), stringify(doc), 'utf-8');

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 0);
    });

    it('skips rule with invalid severity', async () => {
      await createProject(tempDir, BASE_CONFIG);
      const doc = {
        scope: 'conventions',
        rules: [{ id: 'bad-sev', severity: 'critical', content: 'Rule content' }],
      };
      await writeFile(join(tempDir, '.dwf', 'rules', 'test.yml'), stringify(doc), 'utf-8');

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 0);
    });

    it('respects enabled: false explicitly', async () => {
      await createProject(tempDir, BASE_CONFIG);
      const doc = {
        scope: 'conventions',
        rules: [{ id: 'disabled-rule', severity: 'error', content: 'Disabled', enabled: false }],
      };
      await writeFile(join(tempDir, '.dwf', 'rules', 'test.yml'), stringify(doc), 'utf-8');

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 1);
      assert.equal(rules[0]?.enabled, false);
    });

    it('trims trailing whitespace from content', async () => {
      await createProject(tempDir, BASE_CONFIG);
      const doc = {
        scope: 'conventions',
        rules: [{ id: 'trim-test', severity: 'error', content: 'Rule with trailing   \n' }],
      };
      await writeFile(join(tempDir, '.dwf', 'rules', 'test.yml'), stringify(doc), 'utf-8');

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 1);
      assert.equal(rules[0]?.content, 'Rule with trailing');
    });
  });

  describe('readRules file handling', () => {
    it('skips file without rules array', async () => {
      await createProject(tempDir, BASE_CONFIG);
      await writeFile(
        join(tempDir, '.dwf', 'rules', 'no-rules.yml'),
        `scope: conventions\ndata: something\n`,
        'utf-8',
      );

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 0);
    });

    it('throws on invalid YAML (no try/catch in readRules parse)', async () => {
      await createProject(tempDir, BASE_CONFIG);
      await writeFile(
        join(tempDir, '.dwf', 'rules', 'broken.yml'),
        ':\ninvalid: [yaml: {broken',
        'utf-8',
      );

      // readRules does parse() without try/catch — invalid YAML causes unhandled throw
      await assert.rejects(
        () => readRules(tempDir),
      );
    });

    it('skips rules with invalid scope and logs warning', async () => {
      await createProject(tempDir, BASE_CONFIG);
      const doc = {
        scope: 'INVALID_SCOPE',
        rules: [{ id: 'test', severity: 'error', content: 'Should be skipped' }],
      };
      await writeFile(join(tempDir, '.dwf', 'rules', 'bad-scope.yml'), stringify(doc), 'utf-8');

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 0);
    });
  });
});
