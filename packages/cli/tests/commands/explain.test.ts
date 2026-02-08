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

describe('devw explain', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-explain-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shows output for configured tools', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('claude'));
    assert.ok(result.stdout.includes('CLAUDE.md'));
    assert.ok(result.stdout.includes('Rules:'));
    assert.ok(result.stdout.includes('architecture:'));
  });

  it('shows excluded rules with reasons', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Excluded:'));
    assert.ok(result.stdout.includes('[info] arch-info'));
    assert.ok(result.stdout.includes('[disabled] disabled-rule'));
  });

  it('handles --tool filter', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude', 'windsurf']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain', '--tool', 'windsurf'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('windsurf'));
    assert.ok(result.stdout.includes('.windsurf/rules/devworkflows.md'));
    assert.ok(!result.stdout.includes('claude'));
  });

  it('shows windsurf char count', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['windsurf']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Size:'));
    assert.ok(result.stdout.includes('6,000 chars'));
  });

  it('shows mode with markers info', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['copilot']));
    await writeFile(join(tmpDir, '.dwf', 'rules', 'architecture.yml'), RULES_WITH_MIX);

    const result = await run(['explain'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('copilot'));
    assert.ok(result.stdout.includes('.github/copilot-instructions.md'));
    assert.ok(result.stdout.includes('BEGIN/END'));
  });

  it('errors when no config exists', async () => {
    const result = await run(['explain'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('config.yml not found'));
  });

  it('errors when --tool is not configured', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), CONFIG_TEMPLATE(['claude']));

    const result = await run(['explain', '--tool', 'windsurf'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('not configured'));
  });
});
