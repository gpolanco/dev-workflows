import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const execFile = promisify(execFileCb);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEVW = join(__dirname, '..', '..', '..', 'bin', 'devw.js');
const NODE = process.execPath;

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function run(args: string[], cwd: string): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFile(NODE, [DEVW, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; code: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.code ?? 1 };
  }
}

const CONFIG_TEMPLATE = (tools: string[]): string => `version: "0.1"
project:
  name: "test-project"
tools:
${tools.map((t) => `  - ${t}`).join('\n')}
mode: copy
blocks: []
`;

const RULES_CONVENTIONS = `scope: conventions
rules:
  - id: ts-strict-no-any
    severity: error
    content: Never use any.
    sourceBlock: typescript-strict
  - id: ts-strict-explicit-returns
    severity: warning
    content: Always declare return types.
    sourceBlock: typescript-strict
`;

const RULES_WITH_MIX = `scope: architecture
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
  - id: arch-info
    severity: info
    content: This is informational.
  - id: disabled-rule
    severity: error
    enabled: false
    content: This is disabled.
`;

describe('output format: compile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-output-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shows success icon, rule count, arrow, file count, and timing', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), RULES_CONVENTIONS);

    const result = await run(['compile'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('\u2714'), 'should have success icon');
    assert.ok(result.stdout.includes('Compiled'), 'should say Compiled');
    assert.ok(result.stdout.includes('rules'), 'should mention rules');
    assert.ok(result.stdout.includes('\u2192'), 'should have arrow');
    assert.ok(result.stdout.includes('file'), 'should mention files');
    assert.ok(/\(\d+ms\)/.test(result.stdout), 'should have timing');
  });

  it('shows file list with bullet prefix', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), RULES_CONVENTIONS);

    const result = await run(['compile'], tmpDir);

    assert.ok(result.stdout.includes('\u203A'), 'should have bullet prefix');
    assert.ok(result.stdout.includes('CLAUDE.md'), 'should list CLAUDE.md');
  });
});

describe('output format: doctor', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-output-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shows check icons and summary line', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), RULES_CONVENTIONS);

    // Compile first so doctor has hash
    await run(['compile'], tmpDir);
    const result = await run(['doctor'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('\u2714'), 'should have pass icon');
    assert.ok(result.stdout.includes('passed'), 'should show passed count');
    assert.ok(/\(\d+ms\)/.test(result.stdout), 'should have timing');
  });

  it('shows skip icon for skipped checks', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), RULES_CONVENTIONS);

    const result = await run(['doctor'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('\u2013'), 'should have skip icon');
    assert.ok(result.stdout.includes('skipped'), 'should show skipped count');
  });
});

// add --list tests removed: now fetches from GitHub, requires network mocks

describe('output format: list rules', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-output-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shows severity icons for rules', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), RULES_CONVENTIONS);

    const result = await run(['list', 'rules'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('\u2717'), 'should have error icon for error severity');
    assert.ok(result.stdout.includes('\u25B2'), 'should have warning icon for warning severity');
  });
});

describe('output format: list tools', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-output-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shows bullet prefix and arrow with output path', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));

    const result = await run(['list', 'tools'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('\u203A'), 'should have bullet prefix');
    assert.ok(result.stdout.includes('\u2192'), 'should have arrow');
    assert.ok(result.stdout.includes('CLAUDE.md'), 'should show output path');
  });
});

describe('output format: explain', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-output-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shows light separator with tool name', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('\u2500'), 'should have light separator');
    assert.ok(result.stdout.includes('claude'), 'should show tool name');
  });

  it('shows aligned key-value output', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain'], tmpDir);

    assert.ok(result.stdout.includes('Output:'), 'should have Output label');
    assert.ok(result.stdout.includes('Mode:'), 'should have Mode label');
    assert.ok(result.stdout.includes('Rules:'), 'should have Rules label');
    assert.ok(result.stdout.includes('Excluded:'), 'should have Excluded label');
  });

  it('shows new mode labels', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude', 'cursor']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain'], tmpDir);

    assert.ok(result.stdout.includes('markers (BEGIN/END)'), 'should show markers mode for claude');
    assert.ok(result.stdout.includes('full file'), 'should show full file mode for cursor');
  });
});

describe('output format: error messages', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-output-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('compile error shows icon and hint', async () => {
    const result = await run(['compile'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('\u2717'), 'should have error icon');
    assert.ok(result.stderr.includes('config.yml not found'), 'should show error message');
    assert.ok(result.stderr.includes('devw init'), 'should show hint');
  });

  it('remove error shows icon and hint', async () => {
    const result = await run(['remove', 'nonexistent'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('\u2717'), 'should have error icon');
  });
});
