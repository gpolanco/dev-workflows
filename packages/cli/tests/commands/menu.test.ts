import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runMainMenu } from '../../src/commands/menu.js';

function makeMockCommand(): { helpCalled: boolean; help: () => void } {
  const mock = {
    helpCalled: false,
    help(): void {
      this.helpCalled = true;
    },
  };
  return mock;
}

describe('runMainMenu — TTY guard', () => {
  let originalStdoutIsTTY: boolean | undefined;
  let originalStdinIsTTY: boolean | undefined;
  let originalCI: string | undefined;

  beforeEach(() => {
    originalStdoutIsTTY = process.stdout.isTTY;
    originalStdinIsTTY = process.stdin.isTTY;
    originalCI = process.env['CI'];
  });

  afterEach(() => {
    // Restore originals (may be undefined in non-TTY test environments)
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

  it('calls command.help() when stdout is not a TTY', async () => {
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

    const mockCommand = makeMockCommand();
    // Cast to unknown then to the minimal Command interface required
    await runMainMenu(mockCommand as unknown as import('commander').Command);

    assert.equal(mockCommand.helpCalled, true);
  });

  it('calls command.help() when stdin is not a TTY even if stdout is', async () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });

    const mockCommand = makeMockCommand();
    await runMainMenu(mockCommand as unknown as import('commander').Command);

    assert.equal(mockCommand.helpCalled, true);
  });

  it('calls command.help() when CI mode is enabled', async () => {
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

    const mockCommand = makeMockCommand();
    await runMainMenu(mockCommand as unknown as import('commander').Command);

    assert.equal(mockCommand.helpCalled, true);
  });
});
