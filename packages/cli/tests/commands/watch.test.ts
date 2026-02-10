import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEVW = join(__dirname, '..', '..', '..', 'bin', 'devw.js');
const NODE = process.execPath;

const VALID_CONFIG = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
  - cursor
mode: copy
blocks: []
`;

const VALID_CONFIG_CLAUDE_ONLY = `version: "0.1"
project:
  name: "test-project"
tools:
  - claude
mode: copy
blocks: []
`;

const VALID_RULES = `scope: conventions
rules:
  - id: named-exports
    severity: error
    content: Always use named exports.
`;

interface WatchHandle {
  process: ChildProcess;
  waitForOutput: (pattern: string | RegExp, timeout?: number) => Promise<string>;
  getAllOutput: () => string;
  kill: () => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnWatch(cwd: string, args: string[] = []): WatchHandle {
  let output = '';
  const pending: Array<{
    pattern: string | RegExp;
    resolve: (value: string | PromiseLike<string>) => void;
    reject: (reason: Error) => void;
  }> = [];

  const child = spawn(NODE, [DEVW, 'watch', ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const checkPending = (): void => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const entry = pending[i];
      if (!entry) continue;
      const matches = typeof entry.pattern === 'string'
        ? output.includes(entry.pattern)
        : entry.pattern.test(output);
      if (matches) {
        pending.splice(i, 1);
        entry.resolve(output);
      }
    }
  };

  child.stdout?.on('data', (data: Buffer) => {
    output += data.toString();
    checkPending();
  });

  child.stderr?.on('data', (data: Buffer) => {
    output += data.toString();
    checkPending();
  });

  return {
    process: child,
    getAllOutput: () => output,
    waitForOutput: (pattern: string | RegExp, timeout = 10000): Promise<string> => {
      const matches = typeof pattern === 'string'
        ? output.includes(pattern)
        : pattern.test(output);
      if (matches) return Promise.resolve(output);

      return new Promise((resolve, reject) => {
        const entry = { pattern, resolve, reject };
        pending.push(entry);

        const timer = setTimeout(() => {
          const idx = pending.indexOf(entry);
          if (idx !== -1) pending.splice(idx, 1);
          reject(new Error(
            `Timeout waiting for "${String(pattern)}" after ${String(timeout)}ms. Output so far:\n${output}`
          ));
        }, timeout);

        const originalResolve = entry.resolve;
        entry.resolve = (value: string | PromiseLike<string>): void => {
          clearTimeout(timer);
          originalResolve(value);
        };
      });
    },
    kill: (): void => {
      child.kill('SIGINT');
    },
  };
}

describe('devw watch', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devw-watch-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('missing .dwf/ exits with code 1', async () => {
    try {
      await execFile(NODE, [DEVW, 'watch'], {
        cwd: tmpDir,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      });
      assert.fail('Expected process to exit with non-zero code');
    } catch (err: unknown) {
      const e = err as { stdout: string; stderr: string; code: number };
      assert.ok(
        (e.stderr ?? '').includes('.dwf/ not found') || (e.stdout ?? '').includes('.dwf/ not found'),
        `Expected ".dwf/ not found" in output. stderr: ${e.stderr ?? ''}, stdout: ${e.stdout ?? ''}`
      );
      assert.equal(e.code, 1);
    }
  });

  it('startup displays watch message and initial compile', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG_CLAUDE_ONLY);
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), VALID_RULES);

    const handle = spawnWatch(tmpDir);

    try {
      await handle.waitForOutput('Waiting for changes');
      const output = handle.getAllOutput();
      assert.ok(output.includes('Watching .dwf/ for changes'));
      assert.ok(output.includes('Running initial compile'));
      assert.ok(output.includes('claude'));
      assert.ok(output.includes('Ctrl+C to stop'));
    } finally {
      handle.kill();
    }
  });

  it('file change triggers recompilation', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG_CLAUDE_ONLY);
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), VALID_RULES);

    const handle = spawnWatch(tmpDir);

    try {
      await handle.waitForOutput('Waiting for changes');
      await delay(500);

      const updatedRules = `scope: conventions
rules:
  - id: named-exports
    severity: error
    content: Always use named exports in modules.
  - id: no-default
    severity: warning
    content: Avoid default exports.
`;
      await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), updatedRules);

      await handle.waitForOutput('Change detected');
      await handle.waitForOutput('Compiling...');
      const output = handle.getAllOutput();
      assert.ok(output.includes('Change detected'));
      assert.ok(output.includes('Compiling...'));
    } finally {
      handle.kill();
    }
  });

  it('validation error does not kill process', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG_CLAUDE_ONLY);
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), VALID_RULES);

    const handle = spawnWatch(tmpDir);

    try {
      await handle.waitForOutput('Waiting for changes');
      await delay(500);

      // Write invalid config to trigger validation error
      await writeFile(join(tmpDir, '.dwf', 'config.yml'), ':\ninvalid: [yaml: {broken');

      await handle.waitForOutput('still running', 10000);
      const output = handle.getAllOutput();
      assert.ok(output.includes('still running'));

      // Fix the config and verify recompile works
      await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG_CLAUDE_ONLY);

      await handle.waitForOutput(/Done in.*\n.*Done in/s, 10000);
    } finally {
      handle.kill();
    }
  });

  it('--tool flag filters bridges', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG);
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), VALID_RULES);

    const handle = spawnWatch(tmpDir, ['--tool', 'claude']);

    try {
      await handle.waitForOutput('Waiting for changes');
      const output = handle.getAllOutput();
      assert.ok(output.includes('claude'));
      assert.ok(!output.includes('cursor'));
    } finally {
      handle.kill();
    }
  });

  it('SIGINT exits cleanly', async () => {
    await mkdir(join(tmpDir, '.dwf', 'rules'), { recursive: true });
    await writeFile(join(tmpDir, '.dwf', 'config.yml'), VALID_CONFIG_CLAUDE_ONLY);
    await writeFile(join(tmpDir, '.dwf', 'rules', 'conventions.yml'), VALID_RULES);

    const handle = spawnWatch(tmpDir);

    try {
      await handle.waitForOutput('Watching .dwf/ for changes');
    } finally {
      handle.kill();
    }

    const exitCode = await new Promise<number | null>((resolve) => {
      handle.process.on('exit', (code) => resolve(code));
      if (handle.process.exitCode !== null) {
        resolve(handle.process.exitCode);
      }
    });

    assert.ok(exitCode === null || exitCode === 0, `Expected clean exit, got code ${String(exitCode)}`);
  });
});
