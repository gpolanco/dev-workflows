import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readConfig, readRules } from '../../src/core/parser.js';

const BASE_CONFIG = `version: "0.1"
project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []`;

const CONFIG_V02 = `version: "0.2"
project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []
global: false`;

async function createProject(dir: string, configYaml: string): Promise<void> {
  await mkdir(join(dir, '.dwf', 'rules'), { recursive: true });
  await writeFile(join(dir, '.dwf', 'config.yml'), configYaml, 'utf-8');
}

describe('readRules scope metadata parsing', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-parser-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('parses YAML with top-level metadata fields', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
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
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 1);
    assert.ok(rules[0]?.metadata);
    assert.deepEqual(rules[0]?.metadata?.globs, ['**/*.ts', '**/*.tsx']);
    assert.deepEqual(rules[0]?.metadata?.paths, ['src/']);
    assert.equal(rules[0]?.metadata?.trigger, 'always');
  });

  it('parses YAML with nested metadata block', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
metadata:
  globs:
    - "**/*.ts"
  trigger: glob
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 1);
    assert.ok(rules[0]?.metadata);
    assert.deepEqual(rules[0]?.metadata?.globs, ['**/*.ts']);
    assert.equal(rules[0]?.metadata?.trigger, 'glob');
  });

  it('parses YAML without metadata block (backward compat)', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 1);
    assert.equal(rules[0]?.metadata, undefined);
  });

  it('rejects invalid trigger value with warning', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
trigger: invalid
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 1);
    // Metadata should be undefined because validation failed
    assert.equal(rules[0]?.metadata, undefined);
  });

  it('rejects non-array globs with warning', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
globs: "**/*.ts"
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 1);
    // Metadata should be undefined because validation failed
    assert.equal(rules[0]?.metadata, undefined);
  });

  it('rejects non-array paths with warning', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
paths: "src/"
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 1);
    assert.equal(rules[0]?.metadata, undefined);
  });

  it('attaches same metadata to all rules in the scope', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
globs:
  - "**/*.ts"
trigger: always
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
  - id: no-barrel
    severity: warning
    content: Avoid barrel files.
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 2);
    assert.deepEqual(rules[0]?.metadata?.globs, ['**/*.ts']);
    assert.equal(rules[0]?.metadata?.trigger, 'always');
    assert.deepEqual(rules[1]?.metadata?.globs, ['**/*.ts']);
    assert.equal(rules[1]?.metadata?.trigger, 'always');
  });

  it('top-level fields take precedence over nested metadata', async () => {
    await createProject(tmpDir, BASE_CONFIG);
    await writeFile(
      join(tmpDir, '.dwf', 'rules', 'conventions.yml'),
      `scope: conventions
metadata:
  trigger: glob
trigger: always
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`,
      'utf-8',
    );

    const rules = await readRules(tmpDir);

    assert.equal(rules.length, 1);
    assert.equal(rules[0]?.metadata?.trigger, 'always');
  });
});

describe('readConfig version handling', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-config-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reads v0.1 config with global defaulting to true', async () => {
    await createProject(tmpDir, BASE_CONFIG);

    const config = await readConfig(tmpDir);

    assert.equal(config.version, '0.1');
    assert.equal(config.global, true);
  });

  it('reads v0.2 config with explicit global: false', async () => {
    await createProject(tmpDir, CONFIG_V02);

    const config = await readConfig(tmpDir);

    assert.equal(config.version, '0.2');
    assert.equal(config.global, false);
  });

  it('reads v0.2 config with global: true', async () => {
    const configWithGlobalTrue = `version: "0.2"
project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []
global: true`;

    await createProject(tmpDir, configWithGlobalTrue);

    const config = await readConfig(tmpDir);

    assert.equal(config.version, '0.2');
    assert.equal(config.global, true);
  });

  it('rejects unsupported config version', async () => {
    const badConfig = `version: "99.0"
project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []`;

    await createProject(tmpDir, badConfig);

    await assert.rejects(
      () => readConfig(tmpDir),
      (err: Error) => {
        assert.ok(err.message.includes('unsupported version'));
        assert.ok(err.message.includes('99.0'));
        return true;
      },
    );
  });

  it('defaults to v0.1 when version is missing', async () => {
    const noVersion = `project:
  name: test-project
tools:
  - claude
mode: copy
blocks: []`;

    await createProject(tmpDir, noVersion);

    const config = await readConfig(tmpDir);
    assert.equal(config.version, '0.1');
  });
});
