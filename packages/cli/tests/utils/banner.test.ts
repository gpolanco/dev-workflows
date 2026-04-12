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
      '\u001b[38;5;252m██████╗ ███████╗██╗   ██╗██╗    ██╗\u001b[0m',
      '\u001b[38;5;250m██╔══██╗██╔════╝██║   ██║██║    ██║\u001b[0m',
      '\u001b[38;5;247m██║  ██║█████╗  ██║   ██║██║ █╗ ██║\u001b[0m',
      '\u001b[38;5;245m██║  ██║██╔══╝  ╚██╗ ██╔╝██║███╗██║\u001b[0m',
      '\u001b[38;5;242m██████╔╝███████╗ ╚████╔╝ ╚███╔███╔╝\u001b[0m',
      '\u001b[38;5;240m╚═════╝ ╚══════╝  ╚═══╝   ╚══╝╚══╝\u001b[0m',
    ].join('\n');

    assert.equal(renderBanner(), expected);
  });
});
