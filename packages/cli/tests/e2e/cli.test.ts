import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile, access } from 'node:fs/promises';
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
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

    assert.ok(await fileExists(join(tmpDir, '.dwf', 'config.yml')));

    const scopes = ['architecture', 'conventions', 'security', 'workflow', 'testing'];
    for (const scope of scopes) {
      assert.ok(await fileExists(join(tmpDir, '.dwf', 'rules', `${scope}.yml`)));
    }

    const config = await readFile(join(tmpDir, '.dwf', 'config.yml'), 'utf-8');
    assert.ok(config.includes('claude'));
    assert.ok(config.includes('copy'));
  });

  it('init rejects invalid mode with clear error', async () => {
    const result = await run(['init', '--tools', 'claude', '--mode', 'symlinks', '-y'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('Unknown mode'));
    assert.ok(result.stderr.includes('copy, link'));
    assert.ok(!result.stderr.includes('at '), 'should not show stack trace');
  });

  it('init rejects invalid tool with clear error', async () => {
    const result = await run(['init', '--tools', 'noexiste', '--mode', 'copy', '-y'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('Unknown tool'));
    assert.ok(result.stderr.includes('noexiste'));
    assert.ok(!result.stderr.includes('at '), 'should not show stack trace');
  });

  it('init accepts link mode', async () => {
    const result = await run(['init', '--tools', 'claude', '--mode', 'link', '-y'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Initialized'));

    const config = await readFile(join(tmpDir, '.dwf', 'config.yml'), 'utf-8');
    assert.ok(config.includes('link'));
  });

  it('init fails when .dwf/ already exists', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);

    assert.equal(result.exitCode, 1);
    assert.ok(result.stderr.includes('already exists'));
  });

  it('add typescript-strict merges rules and updates config', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['add', 'typescript-strict', '--no-compile'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Added'));

    const conventions = await readFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), 'utf-8');
    assert.ok(conventions.includes('ts-strict-no-any'));

    const config = await readFile(join(tmpDir, '.dwf', 'config.yml'), 'utf-8');
    assert.ok(config.includes('typescript-strict'));
  });

  it('compile generates CLAUDE.md with markers', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'typescript-strict', '--no-compile'], tmpDir);
    const result = await run(['compile'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Compiled'));

    const claudeMd = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeMd.includes('<!-- BEGIN dev-workflows -->'));
    assert.ok(claudeMd.includes('<!-- END dev-workflows -->'));
    assert.ok(claudeMd.includes('# Project Rules'));
  });

  it('compile preserves user content outside markers', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'typescript-strict', '--no-compile'], tmpDir);

    // First compile to create CLAUDE.md with markers
    await run(['compile'], tmpDir);

    // Add user content before and after the markers
    const claudeMd = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const withUserContent = `# My Custom Rules\n\nDo not touch this.\n\n${claudeMd}\n# Footer\n\nAlso keep this.\n`;
    await writeFile(join(tmpDir, 'CLAUDE.md'), withUserContent, 'utf-8');

    // Recompile
    const result = await run(['compile'], tmpDir);
    assert.equal(result.exitCode, 0);

    const updated = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(updated.includes('# My Custom Rules'));
    assert.ok(updated.includes('Do not touch this.'));
    assert.ok(updated.includes('# Footer'));
    assert.ok(updated.includes('Also keep this.'));
    assert.ok(updated.includes('<!-- BEGIN dev-workflows -->'));
    assert.ok(updated.includes('# Project Rules'));
  });

  it('compile --dry-run preserves user content outside markers', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'typescript-strict', '--no-compile'], tmpDir);

    // First compile to create CLAUDE.md with markers
    await run(['compile'], tmpDir);

    // Add user content before and after the markers
    const claudeMd = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const withUserContent = `# My Custom Rules\n\nDo not touch this.\n\n${claudeMd}\n# Footer\n\nAlso keep this.\n`;
    await writeFile(join(tmpDir, 'CLAUDE.md'), withUserContent, 'utf-8');

    // Dry-run should show merged content (not just raw rules)
    const result = await run(['compile', '--dry-run'], tmpDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('# My Custom Rules'), 'dry-run should include user content before markers');
    assert.ok(result.stdout.includes('Do not touch this.'), 'dry-run should include user content before markers');
    assert.ok(result.stdout.includes('# Footer'), 'dry-run should include user content after markers');
    assert.ok(result.stdout.includes('<!-- BEGIN dev-workflows -->'));
    assert.ok(result.stdout.includes('# Project Rules'));
  });

  it('list rules shows added rules', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'typescript-strict', '--no-compile'], tmpDir);
    const result = await run(['list', 'rules'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('ts-strict-no-any'));
    assert.ok(result.stdout.includes('ts-strict-explicit-returns'));
  });

  it('list blocks shows installed blocks', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'typescript-strict', '--no-compile'], tmpDir);
    const result = await run(['list', 'blocks'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('typescript-strict'));
  });

  it('list tools shows configured tools', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    const result = await run(['list', 'tools'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('claude'));
  });

  it('doctor passes on valid project', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'typescript-strict'], tmpDir);
    const result = await run(['doctor'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('config.yml exists'));
    assert.ok(result.stdout.includes('config.yml is valid'));
  });

  it('add --list shows all available blocks', async () => {
    const result = await run(['add', '--list'], tmpDir);

    assert.equal(result.exitCode, 0);
    const expected = [
      'typescript-strict',
      'react-conventions',
      'nextjs-approuter',
      'tailwind',
      'testing-basics',
      'supabase-rls',
    ];
    for (const block of expected) {
      assert.ok(result.stdout.includes(block), `should list block "${block}"`);
    }
  });

  it('remove typescript-strict removes rules and updates config', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'typescript-strict', '--no-compile'], tmpDir);

    const result = await run(['remove', 'typescript-strict'], tmpDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Removed'));

    const conventions = await readFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), 'utf-8');
    assert.ok(!conventions.includes('ts-strict-no-any'));

    const config = await readFile(join(tmpDir, '.dwf', 'config.yml'), 'utf-8');
    assert.ok(!config.includes('typescript-strict'));
  });

  it('remove recompiles output files so removed rules disappear', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'supabase-rls'], tmpDir);
    await run(['add', 'typescript-strict'], tmpDir);

    const before = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(before.includes('Every new table must have RLS policies'), 'CLAUDE.md should contain supabase rules before remove');
    assert.ok(before.includes('explicit return types'), 'CLAUDE.md should contain typescript-strict rules');

    const result = await run(['remove', 'supabase-rls'], tmpDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('Compiled'), 'remove should trigger recompile');

    const after = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(!after.includes('Every new table must have RLS policies'), 'CLAUDE.md should not contain supabase rules after remove');
    assert.ok(after.includes('explicit return types'), 'CLAUDE.md should still contain typescript-strict rules');
  });

  it('remove last block deletes output file when no user content', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'supabase-rls'], tmpDir);

    assert.ok(await fileExists(join(tmpDir, 'CLAUDE.md')), 'CLAUDE.md should exist before remove');

    const result = await run(['remove', 'supabase-rls'], tmpDir);
    assert.equal(result.exitCode, 0);

    assert.ok(!(await fileExists(join(tmpDir, 'CLAUDE.md'))), 'CLAUDE.md should be deleted when no user content remains');
  });

  it('remove last block preserves user content outside markers', async () => {
    await run(['init', '--tools', 'claude', '--mode', 'copy', '-y'], tmpDir);
    await run(['add', 'supabase-rls'], tmpDir);

    // Add user content around the markers
    const claudeMd = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    await writeFile(join(tmpDir, 'CLAUDE.md'), `# My Notes\n\nKeep this.\n\n${claudeMd}`, 'utf-8');

    const result = await run(['remove', 'supabase-rls'], tmpDir);
    assert.equal(result.exitCode, 0);

    const after = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(after.includes('# My Notes'), 'user content should be preserved');
    assert.ok(after.includes('Keep this.'), 'user content should be preserved');
    assert.ok(!after.includes('<!-- BEGIN dev-workflows -->'), 'markers should be removed');
    assert.ok(!after.includes('RLS policies'), 'rules should be removed');
  });
});
