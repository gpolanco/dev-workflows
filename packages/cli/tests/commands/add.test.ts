import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import { validateInput, generateYamlOutput, updateConfig, pluralRules, BACK_VALUE } from '../../src/commands/add.js';
import { convert } from '../../src/core/converter.js';
import type { PulledEntry } from '../../src/bridges/types.js';

const MOCK_MARKDOWN = `---
name: strict
description: "Strict TypeScript conventions"
version: "0.2.0"
scope: conventions
tags: [typescript, strict]
---

## Type Safety

- Never use any. Use unknown instead.
`;

async function createProject(dir: string, extraYaml = ''): Promise<void> {
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
${extraYaml}`,
    'utf-8',
  );
}

describe('add command', () => {
  describe('validateInput', () => {
    it('returns null for empty string', () => {
      assert.equal(validateInput(''), null);
    });

    it('returns null for single segment (no slash)', () => {
      assert.equal(validateInput('typescript'), null);
    });

    it('returns null for triple segment (two slashes)', () => {
      assert.equal(validateInput('a/b/c'), null);
    });

    it('returns null for trailing slash', () => {
      assert.equal(validateInput('typescript/'), null);
    });

    it('returns null for leading slash', () => {
      assert.equal(validateInput('/strict'), null);
    });

    it('returns null for empty segments (double slash)', () => {
      assert.equal(validateInput('/'), null);
    });

    it('returns null for uppercase input', () => {
      assert.equal(validateInput('TypeScript/Strict'), null);
    });

    it('returns null for underscores', () => {
      assert.equal(validateInput('type_script/my_rule'), null);
    });

    it('returns null for dots in segment', () => {
      assert.equal(validateInput('type.script/rule'), null);
    });

    it('returns null for spaces in segment', () => {
      assert.equal(validateInput('type script/rule'), null);
    });

    it('returns valid result for correct input', () => {
      const result = validateInput('typescript/strict');
      assert.deepEqual(result, { category: 'typescript', name: 'strict' });
    });

    it('returns valid result for segments with only numbers', () => {
      const result = validateInput('123/456');
      assert.deepEqual(result, { category: '123', name: '456' });
    });

    it('returns valid result for kebab-case', () => {
      const result = validateInput('my-category/my-rule');
      assert.deepEqual(result, { category: 'my-category', name: 'my-rule' });
    });
  });

  describe('generateYamlOutput', () => {
    it('header contains path, version, and GitHub URL', () => {
      const result = convert(MOCK_MARKDOWN, 'typescript', 'strict');
      const output = generateYamlOutput('typescript', 'strict', result, '2026-02-11T00:00:00Z');

      assert.ok(output.includes('typescript/strict'));
      assert.ok(output.includes('v0.2.0'));
      assert.ok(output.includes('https://github.com/gpolanco/dev-workflows/blob/main/content/rules/typescript/strict.md'));
    });

    it('roundtrip YAML: generate → parse → validate fields', () => {
      const result = convert(MOCK_MARKDOWN, 'typescript', 'strict');
      const output = generateYamlOutput('typescript', 'strict', result, '2026-02-11T00:00:00Z');

      const yamlBody = output.split('\n').filter((l) => !l.startsWith('#')).join('\n');
      const doc = parse(yamlBody) as Record<string, unknown>;

      const source = doc['source'] as Record<string, unknown>;
      assert.equal(source['registry'], 'dev-workflows');
      assert.equal(source['path'], 'typescript/strict');
      assert.equal(source['version'], '0.2.0');
      assert.equal(source['pulled_at'], '2026-02-11T00:00:00Z');

      const rules = doc['rules'] as Array<Record<string, unknown>>;
      assert.ok(rules.length > 0);
      assert.equal(rules[0]?.['severity'], 'error');
      assert.equal(rules[0]?.['source'], 'typescript/strict');
    });

    it('special characters in content survive YAML roundtrip', () => {
      const specialMd = `---
name: special
description: "Special chars test"
version: "0.1.0"
scope: conventions
tags: []
---

- Use backticks for \`code\`, colons: like this, and "quotes" in content.
`;
      const result = convert(specialMd, 'test', 'special');
      const output = generateYamlOutput('test', 'special', result, '2026-02-11T00:00:00Z');

      const yamlBody = output.split('\n').filter((l) => !l.startsWith('#')).join('\n');
      const doc = parse(yamlBody) as Record<string, unknown>;
      const rules = doc['rules'] as Array<Record<string, unknown>>;
      const content = rules[0]?.['content'] as string;
      assert.ok(content.includes('`code`'));
      assert.ok(content.includes('colons:'));
      assert.ok(content.includes('"quotes"'));
    });
  });

  describe('updateConfig', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'dwf-add-test-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('preserves existing entries when adding a new one', async () => {
      await createProject(tempDir, `pulled:
  - path: "javascript/react"
    version: "0.1.0"
    pulled_at: "2026-01-01T00:00:00Z"`);

      const newEntry: PulledEntry = {
        path: 'typescript/strict',
        version: '0.2.0',
        pulled_at: '2026-02-11T00:00:00Z',
      };

      await updateConfig(tempDir, newEntry);

      const raw = await readFile(join(tempDir, '.dwf', 'config.yml'), 'utf-8');
      const doc = parse(raw) as Record<string, unknown>;
      const pulled = doc['pulled'] as PulledEntry[];
      assert.equal(pulled.length, 2);
      assert.equal(pulled[0]?.path, 'javascript/react');
      assert.equal(pulled[1]?.path, 'typescript/strict');
    });

    it('replaces entry with same path (no duplication)', async () => {
      await createProject(tempDir, `pulled:
  - path: "typescript/strict"
    version: "0.1.0"
    pulled_at: "2026-01-01T00:00:00Z"`);

      const updatedEntry: PulledEntry = {
        path: 'typescript/strict',
        version: '0.3.0',
        pulled_at: '2026-02-11T00:00:00Z',
      };

      await updateConfig(tempDir, updatedEntry);

      const raw = await readFile(join(tempDir, '.dwf', 'config.yml'), 'utf-8');
      const doc = parse(raw) as Record<string, unknown>;
      const pulled = doc['pulled'] as PulledEntry[];
      assert.equal(pulled.length, 1);
      assert.equal(pulled[0]?.version, '0.3.0');
    });

    it('creates pulled array when config has no pulled key', async () => {
      await createProject(tempDir);

      const entry: PulledEntry = {
        path: 'typescript/strict',
        version: '0.1.0',
        pulled_at: '2026-02-11T00:00:00Z',
      };

      await updateConfig(tempDir, entry);

      const raw = await readFile(join(tempDir, '.dwf', 'config.yml'), 'utf-8');
      const doc = parse(raw) as Record<string, unknown>;
      const pulled = doc['pulled'] as PulledEntry[];
      assert.ok(Array.isArray(pulled));
      assert.equal(pulled.length, 1);
      assert.equal(pulled[0]?.path, 'typescript/strict');
    });
  });

  describe('pluralRules', () => {
    it('returns singular for 1', () => {
      assert.equal(pluralRules(1), '1 rule');
    });

    it('returns plural for 0', () => {
      assert.equal(pluralRules(0), '0 rules');
    });

    it('returns plural for 2', () => {
      assert.equal(pluralRules(2), '2 rules');
    });

    it('returns plural for large numbers', () => {
      assert.equal(pluralRules(42), '42 rules');
    });
  });

  describe('BACK_VALUE', () => {
    it('equals __back__', () => {
      assert.equal(BACK_VALUE, '__back__');
    });

    it('is filtered out from real rule selections', () => {
      const selected = [BACK_VALUE, 'react', 'nextjs'];
      const realRules = selected.filter((v) => v !== BACK_VALUE);
      assert.deepEqual(realRules, ['react', 'nextjs']);
    });

    it('detects back-only selection', () => {
      const selected = [BACK_VALUE];
      const realRules = selected.filter((v) => v !== BACK_VALUE);
      assert.equal(realRules.length, 0);
      assert.ok(selected.includes(BACK_VALUE));
    });
  });

  describe('installed rule detection', () => {
    it('identifies installed paths from pulled entries', () => {
      const pulled: PulledEntry[] = [
        { path: 'javascript/react', version: '0.1.0', pulled_at: '2026-01-01T00:00:00Z' },
        { path: 'typescript/strict', version: '0.2.0', pulled_at: '2026-01-01T00:00:00Z' },
      ];
      const installedPaths = new Set(pulled.map((p) => p.path));

      assert.ok(installedPaths.has('javascript/react'));
      assert.ok(installedPaths.has('typescript/strict'));
      assert.ok(!installedPaths.has('css/tailwind'));
    });

    it('detects all-installed category', () => {
      const pulled: PulledEntry[] = [
        { path: 'javascript/react', version: '0.1.0', pulled_at: '2026-01-01T00:00:00Z' },
        { path: 'javascript/nextjs', version: '0.1.0', pulled_at: '2026-01-01T00:00:00Z' },
      ];
      const installedPaths = new Set(pulled.map((p) => p.path));

      const categoryRules = [
        { name: 'react', description: 'React conventions' },
        { name: 'nextjs', description: 'Next.js patterns' },
      ];

      const allInstalled = categoryRules.every((r) =>
        installedPaths.has(`javascript/${r.name}`),
      );
      assert.ok(allInstalled);
    });

    it('detects partially-installed category', () => {
      const pulled: PulledEntry[] = [
        { path: 'javascript/react', version: '0.1.0', pulled_at: '2026-01-01T00:00:00Z' },
      ];
      const installedPaths = new Set(pulled.map((p) => p.path));

      const categoryRules = [
        { name: 'react', description: 'React conventions' },
        { name: 'nextjs', description: 'Next.js patterns' },
      ];

      const allInstalled = categoryRules.every((r) =>
        installedPaths.has(`javascript/${r.name}`),
      );
      assert.ok(!allInstalled);
    });
  });
});
