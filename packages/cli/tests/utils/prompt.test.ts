import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInteractiveSession,
  selectPrompt,
  spinnerTask,
  introPrompt,
  outroPrompt,
  notePrompt,
} from '../../src/utils/prompt.js';

describe('prompt utils', () => {
  let originalStdoutIsTTY: boolean | undefined;
  let originalStdinIsTTY: boolean | undefined;
  let originalCI: string | undefined;

  beforeEach(() => {
    originalStdoutIsTTY = process.stdout.isTTY;
    originalStdinIsTTY = process.stdin.isTTY;
    originalCI = process.env['CI'];
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalStdoutIsTTY,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalStdinIsTTY,
      writable: true,
      configurable: true,
    });

    if (originalCI === undefined) {
      delete process.env['CI'];
    } else {
      process.env['CI'] = originalCI;
    }
  });

  it('returns false when stdout is not a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
    delete process.env['CI'];

    assert.equal(isInteractiveSession(), false);
  });

  it('returns false when CI is enabled even if both streams are TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
    process.env['CI'] = 'true';

    assert.equal(isInteractiveSession(), false);
  });

  it('returns true for interactive non-CI session', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
    process.env['CI'] = 'false';

    assert.equal(isInteractiveSession(), true);
  });

  it('throws a helpful message for prompts in non-interactive mode', async () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });

    await assert.rejects(
      async () => selectPrompt({ message: 'Pick one', options: [{ label: 'one', value: 'one' }] }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /non-interactive mode/);
        return true;
      },
    );
  });

  it('runs spinner tasks without clack spinner in non-interactive mode', async () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });

    const result = await spinnerTask({
      label: 'work',
      task: async () => 'ok',
    });

    assert.equal(result, 'ok');
  });

  it('intro/outro/note are no-ops in non-interactive mode', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });

    assert.doesNotThrow(() => {
      introPrompt('hello');
      notePrompt('body', 'title');
      outroPrompt('bye');
    });
  });
});
