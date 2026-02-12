import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
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

describe('devw CLI e2e', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-e2e-'));
    await execFile('git', ['init'], { cwd: tmpDir });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('init creates config and rule files', async () => {
    const result = await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Initialized'));

    const config = await readFile(join(tmpDir, '.dwf', 'config.yml'), 'utf-8');
    assert.ok(config.includes('claude'));
    assert.ok(config.includes('copy'));
  });

  it('init rejects invalid mode with clear error', async () => {
    const result = await run(['init', '--tools', 'claude', '--mode', 'symlinks', '-y'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('Unknown mode'));
    assert.ok(result.stderr.includes('copy, link'));
  });

  it('init rejects invalid tool with clear error', async () => {
    const result = await run(['init', '--tools', 'noexiste', '--mode', 'copy', '-y'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('Unknown tool'));
  });

  it('init fails when .dwf/ already exists', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('already exists'));
  });

  it('compile generates CLAUDE.md with markers when rules exist', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);

    // Write a manual rule so compile has something to output
    const rulesPath = join(tmpDir, '.dwf', 'rules', 'conventions.yml');
    await writeFile(
      rulesPath,
      `scope: conventions
rules:
  - id: test-rule
    severity: error
    content: Always test your code.
`,
      'utf-8',
    );

    const result = await run(['compile'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Compiled'));

    const claudeMd = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeMd.includes('<!-- BEGIN dev-workflows -->'));
    assert.ok(claudeMd.includes('<!-- END dev-workflows -->'));
  });

  it('compile preserves user content outside markers', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);

    const rulesPath = join(tmpDir, '.dwf', 'rules', 'conventions.yml');
    await writeFile(
      rulesPath,
      `scope: conventions
rules:
  - id: test-rule
    severity: error
    content: Always test your code.
`,
      'utf-8',
    );

    await run(['compile'], tmpDir);

    const claudeMd = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const withUserContent = `# My Custom Rules\n\nDo not touch this.\n\n${claudeMd}\n# Footer\n\nAlso keep this.\n`;
    await writeFile(join(tmpDir, 'CLAUDE.md'), withUserContent, 'utf-8');

    const result = await run(['compile'], tmpDir);
    assert.equal(result.exitCode, 0);

    const updated = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(updated.includes('# My Custom Rules'));
    assert.ok(updated.includes('Do not touch this.'));
    assert.ok(updated.includes('# Footer'));
    assert.ok(updated.includes('Also keep this.'));
    assert.ok(updated.includes('<!-- BEGIN dev-workflows -->'));
  });

  it('list rules shows rules from rule files', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);

    const rulesPath = join(tmpDir, '.dwf', 'rules', 'conventions.yml');
    await writeFile(
      rulesPath,
      `scope: conventions
rules:
  - id: manual-rule
    severity: error
    content: A manual rule.
`,
      'utf-8',
    );

    const result = await run(['list', 'rules'], tmpDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('manual-rule'));
  });

  it('list blocks shows deprecation message', async () => {
    const result = await run(['list', 'blocks'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Blocks have been replaced'));
    assert.ok(result.stdout.includes('devw list rules'));
    assert.ok(result.stdout.includes('devw add --list'));
  });

  it('list tools shows configured tools', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['list', 'tools'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('claude'));
  });

  it('doctor passes on valid project', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['doctor'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('config.yml exists'));
    assert.ok(result.stdout.includes('config.yml is valid'));
  });

  it('add without args and non-TTY exits with error', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    // execFile runs in non-TTY mode by default
    const result = await run(['add'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('No rule specified'));
  });

  it('add with old block format exits with error', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['add', 'typescript-strict'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('Block format is no longer supported'));
  });

  it('add with invalid format exits with error', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['add', 'INVALID/FORMAT'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('Invalid rule path'));
  });

  it('remove without pulled rules shows warning', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    // Non-TTY, no args, no pulled → should warn
    const result = await run(['remove'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('No rules installed'));
  });

  it('remove with old block format exits with error', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['remove', 'typescript-strict'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('Block format is no longer supported'));
  });

  it('remove non-installed rule exits with error', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['remove', 'typescript/strict'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('not installed'));
  });
});
