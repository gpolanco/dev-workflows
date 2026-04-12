import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTable } from '../../src/utils/table.js';

describe('renderTable', () => {
  it('renders deterministic borders and rows', () => {
    const output = renderTable(
      ['bridge', 'generated', 'failed'],
      [
        ['claude', '2', '0'],
        ['gemini', '1', '1'],
      ],
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
    const output = renderTable(['id'], [['x']], [5]);
    assert.ok(output.includes('│ id    │'));
    assert.ok(output.includes('│ x     │'));
  });
});
