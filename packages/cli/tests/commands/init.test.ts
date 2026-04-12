import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInit } from '../../src/commands/init.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('runInit', () => {
  let tmpDir: string;
  let projectDir: string;
  let fakeHome: string;
  let previousCwd: string;
  let previousHome: string | undefined;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-init-'));
    projectDir = join(tmpDir, 'project');
    fakeHome = join(tmpDir, 'home');
    previousCwd = process.cwd();
    previousHome = process.env['HOME'];

    await rm(projectDir, { recursive: true, force: true });
    await rm(fakeHome, { recursive: true, force: true });
    await Promise.all([
      mkdir(projectDir, { recursive: true }),
      mkdir(fakeHome, { recursive: true }),
    ]);

    process.env['HOME'] = fakeHome;
    process.chdir(projectDir);
    process.exitCode = 0;
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    if (previousHome === undefined) {
      delete process.env['HOME'];
    } else {
      process.env['HOME'] = previousHome;
    }
    process.exitCode = 0;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('initializes project mode by default with -y', async () => {
    await runInit({ tools: 'claude', mode: 'copy', yes: true });

    assert.ok(await fileExists(join(projectDir, '.dwf', 'config.yml')));
    assert.ok(await fileExists(join(projectDir, '.dwf', 'rules', 'conventions.yml')));
    assert.ok(!(await fileExists(join(fakeHome, '.dwf', 'config.yml'))));
  });

  it('initializes global mode with --global and creates canonical directory', async () => {
    await runInit({ global: true, tools: 'claude', mode: 'copy', yes: true });

    const globalConfigPath = join(fakeHome, '.dwf', 'config.yml');
    assert.ok(await fileExists(globalConfigPath));
    assert.ok(await fileExists(join(fakeHome, '.dwf', 'rules', 'conventions.yml')));
    assert.ok(await fileExists(join(fakeHome, '.agents', 'rules', 'devw')));
    assert.ok(!(await fileExists(join(projectDir, '.dwf', 'config.yml'))));

    const config = await readFile(globalConfigPath, 'utf-8');
    assert.ok(config.includes('version: "0.2"'));
    assert.ok(config.includes('global: true'));
  });
});
