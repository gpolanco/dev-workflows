import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBanner } from '../../src/utils/banner.js';

describe('renderBanner', () => {
  let originalStdoutIsTTY: boolean | undefined;

  beforeEach(() => {
    originalStdoutIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalStdoutIsTTY,
      writable: true,
      configurable: true,
    });
  });

  it('returns empty string when stdout is not a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });

    assert.equal(renderBanner(), '');
  });

  it('returns deterministic ANSI banner for TTY output', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });

    const expected = [
      '\u001b[38;5;45m ____             __      __           __      __\u001b[0m',
      '\u001b[38;5;84m|  _ \\  ___ _   _\\ \\    / /__  _ __| | __ / _| ___  __ _\u001b[0m',
      "\u001b[38;5;123m| | | |/ _ \\ | | |\\ \\  / / _ \\| '__| |/ /| |_ / _ \\/ _` |\u001b[0m",
      '\u001b[38;5;162m| |_| |  __/ |_| | \\ \\/ / (_) | |  |   < |  _|  __/ (_| |\u001b[0m',
      '\u001b[38;5;201m|____/ \\___|\\__,_|  \\__/ \\___/|_|  |_|\\_\\|_|  \\___|\\__,_|\u001b[0m',
    ].join('\n');

    assert.equal(renderBanner(), expected);
  });
});
