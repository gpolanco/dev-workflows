import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTable } from '../../src/utils/table.js';

// picocolors enables colors when the `CI` env var is set, so the bold header
// cells gain ANSI escape codes in CI but not locally. Strip them to keep the
// assertions deterministic across environments.
const stripAnsi = (value: string): string => value.replace(/\x1b\[[0-9;]*m/g, '');

describe('renderTable', () => {
  it('renders deterministic borders and rows', () => {
    const output = stripAnsi(
      renderTable(
        ['bridge', 'generated', 'failed'],
        [
          ['claude', '2', '0'],
          ['gemini', '1', '1'],
        ],
      ),
    );

    const expected = [
      '  ┌────────┬───────────┬────────┐',
      '  │ bridge │ generated │ failed │',
      '  ├────────┼───────────┼────────┤',
      '  │ claude │ 2         │ 0      │',
      '  │ gemini │ 1         │ 1      │',
      '  └────────┴───────────┴────────┘',
    ].join('\n');

    assert.equal(output, expected);
  });

  it('returns empty string when headers are empty', () => {
    assert.equal(renderTable([], [['value']]), '');
  });

  it('honors minimum column widths', () => {
    const output = stripAnsi(renderTable(['id'], [['x']], [5]));
    assert.ok(output.includes('│ id    │'));
    assert.ok(output.includes('│ x     │'));
  });
});
