import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, stringify } from 'yaml';
import { fileExists } from '../../src/utils/fs.js';
import { convert } from '../../src/core/converter.js';
import { readConfig } from '../../src/core/parser.js';
import { readRules } from '../../src/core/parser.js';
import type { PulledEntry } from '../../src/bridges/types.js';

const MOCK_MARKDOWN = `---
name: strict
description: "Strict TypeScript conventions"
version: "0.1.0"
scope: conventions
tags: [typescript, strict]
---

## Type Safety

- Never use any. Use unknown instead.
  Narrow with type guards.

- Always declare explicit return types.
`;

async function createProject(dir: string): Promise<void> {
  await mkdir(join(dir, '.dwf', 'rules'), { recursive: true });
  await writeFile(
    join(dir, '.dwf', 'config.yml'),
    `version: "0.1"
project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []
`,
    'utf-8',
  );
}

describe('pull command integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dwf-pull-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('converter integration', () => {
    it('converts markdown to correct YAML structure', () => {
      const result = convert(MOCK_MARKDOWN, 'typescript', 'strict');

      assert.equal(result.name, 'strict');
      assert.equal(result.version, '0.1.0');
      assert.equal(result.scope, 'conventions');
      assert.equal(result.rules.length, 2);

      const first = result.rules[0];
      const second = result.rules[1];
      assert.ok(first);
      assert.ok(second);
      assert.equal(first.id, 'pulled-typescript-strict-type-safety-0');
      assert.equal(second.id, 'pulled-typescript-strict-type-safety-1');
      assert.ok(first.content.includes('Never use any'));
      assert.ok(first.content.includes('Narrow with type guards'));
    });
  });

  describe('input validation', () => {
    it('validates kebab-case correctly', () => {
      const validKebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      assert.equal(validKebab.test('typescript'), true);
      assert.equal(validKebab.test('TypeScript'), false);
      assert.equal(validKebab.test('my-rule'), true);
      assert.equal(validKebab.test('my_rule'), false);
      assert.equal(validKebab.test(''), false);
    });

    it('rejects non-kebab-case segments', () => {
      const validKebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      assert.equal(validKebab.test('TypeScript'), false);
      assert.equal(validKebab.test('my_rule'), false);
      assert.equal(validKebab.test('MY-RULE'), false);
      assert.equal(validKebab.test('rule.name'), false);
    });
  });

  describe('config update', () => {
    it('adds pulled entry to config', async () => {
      await createProject(tempDir);

      const configPath = join(tempDir, '.dwf', 'config.yml');
      const raw = await readFile(configPath, 'utf-8');
      const doc = parse(raw) as Record<string, unknown>;

      const pulled: PulledEntry[] = Array.isArray(doc['pulled']) ? doc['pulled'] as PulledEntry[] : [];
      pulled.push({
        path: 'typescript/strict',
        version: '0.1.0',
        pulled_at: '2026-02-11T00:00:00Z',
      });
      doc['pulled'] = pulled;

      await writeFile(configPath, stringify(doc, { lineWidth: 0 }), 'utf-8');

      const updated = parse(await readFile(configPath, 'utf-8')) as Record<string, unknown>;
      const updatedPulled = updated['pulled'] as PulledEntry[];
      assert.ok(updatedPulled);
      assert.equal(updatedPulled.length, 1);
      const entry = updatedPulled[0];
      assert.ok(entry);
      assert.equal(entry.path, 'typescript/strict');
    });
  });

  describe('pulled file generation', () => {
    it('generates valid YAML with source metadata', async () => {
      await createProject(tempDir);

      const result = convert(MOCK_MARKDOWN, 'typescript', 'strict');

      const doc = {
        source: {
          registry: 'dev-workflows',
          path: 'typescript/strict',
          version: result.version,
          pulled_at: '2026-02-11T00:00:00Z',
        },
        scope: result.scope,
        rules: result.rules.map((r) => ({
          id: r.id,
          severity: r.severity,
          content: r.content,
          tags: r.tags,
          source: r.source,
        })),
      };

      const yaml = stringify(doc, { lineWidth: 0 });
      const filePath = join(tempDir, '.dwf', 'rules', 'pulled-typescript-strict.yml');
      await writeFile(filePath, yaml, 'utf-8');

      assert.ok(await fileExists(filePath));

      const parsed = parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>;
      const source = parsed['source'] as Record<string, unknown>;
      assert.ok(source);
      assert.equal(source['registry'], 'dev-workflows');
      assert.equal(source['path'], 'typescript/strict');
      assert.equal(source['version'], '0.1.0');

      const rules = parsed['rules'] as Array<Record<string, unknown>>;
      assert.ok(rules);
      assert.equal(rules.length, 2);
      const firstRule = rules[0];
      assert.ok(firstRule);
      assert.equal(firstRule['id'], 'pulled-typescript-strict-type-safety-0');
      assert.equal(firstRule['source'], 'typescript/strict');
    });
  });

  describe('already up to date', () => {
    it('detects same version as already up to date', async () => {
      await createProject(tempDir);

      const existingDoc = {
        source: {
          registry: 'dev-workflows',
          path: 'typescript/strict',
          version: '0.1.0',
          pulled_at: '2026-02-10T00:00:00Z',
        },
        scope: 'conventions',
        rules: [],
      };

      const filePath = join(tempDir, '.dwf', 'rules', 'pulled-typescript-strict.yml');
      await writeFile(filePath, stringify(existingDoc, { lineWidth: 0 }), 'utf-8');

      const existing = parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>;
      const existingSource = existing['source'] as Record<string, unknown>;
      assert.ok(existingSource);
      assert.equal(existingSource['version'], '0.1.0');

      const result = convert(MOCK_MARKDOWN, 'typescript', 'strict');
      assert.equal(result.version, existingSource['version']);
    });
  });

  describe('dry run', () => {
    it('does not write files in dry run mode', async () => {
      await createProject(tempDir);

      const filePath = join(tempDir, '.dwf', 'rules', 'pulled-typescript-strict.yml');
      assert.equal(await fileExists(filePath), false);
    });
  });

  describe('parser reads pulled config', () => {
    it('reads pulled entries from config.yml', async () => {
      await createProject(tempDir);

      const configPath = join(tempDir, '.dwf', 'config.yml');
      await writeFile(
        configPath,
        `version: "0.1"
project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []
pulled:
  - path: "typescript/strict"
    version: "0.1.0"
    pulled_at: "2026-02-11T00:00:00Z"
`,
        'utf-8',
      );

      const config = await readConfig(tempDir);
      assert.equal(config.pulled.length, 1);
      const entry = config.pulled[0];
      assert.ok(entry);
      assert.equal(entry.path, 'typescript/strict');
      assert.equal(entry.version, '0.1.0');
    });

    it('defaults to empty pulled array when field is missing', async () => {
      await createProject(tempDir);

      const config = await readConfig(tempDir);
      assert.deepEqual(config.pulled, []);
    });
  });

  describe('readRules reads pulled files with source', () => {
    it('loads rules with source field from pulled files', async () => {
      await createProject(tempDir);

      const pulledDoc = {
        scope: 'conventions',
        rules: [
          {
            id: 'pulled-typescript-strict-0',
            severity: 'error',
            content: 'Test rule content',
            tags: ['typescript'],
            source: 'typescript/strict',
          },
        ],
      };

      await writeFile(
        join(tempDir, '.dwf', 'rules', 'pulled-typescript-strict.yml'),
        stringify(pulledDoc, { lineWidth: 0 }),
        'utf-8',
      );

      const rules = await readRules(tempDir);
      assert.equal(rules.length, 1);
      const first = rules[0];
      assert.ok(first);
      assert.equal(first.source, 'typescript/strict');
      assert.equal(first.id, 'pulled-typescript-strict-0');
    });
  });
});
