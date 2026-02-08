import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MARKER_BEGIN, MARKER_END, mergeMarkedContent, removeMarkedBlock } from '../../src/core/markers.js';

describe('mergeMarkedContent', () => {
  const newBlock = '# Project Rules\n\n## Security\n\n- Do not hardcode secrets.\n';

  it('wraps content in markers when no existing file', () => {
    const result = mergeMarkedContent(null, newBlock);
    assert.equal(result, `${MARKER_BEGIN}\n${newBlock}${MARKER_END}\n`);
  });

  it('replaces content between markers in existing file', () => {
    const existing = [
      '# My Custom Rules',
      '',
      'Some hand-written content.',
      '',
      MARKER_BEGIN,
      '# Old generated content',
      MARKER_END,
      '',
      '# More custom stuff',
      '',
    ].join('\n');

    const result = mergeMarkedContent(existing, newBlock);

    assert.ok(result.startsWith('# My Custom Rules\n'));
    assert.ok(result.includes(MARKER_BEGIN));
    assert.ok(result.includes(newBlock));
    assert.ok(result.includes(MARKER_END));
    assert.ok(result.includes('# More custom stuff'));
    assert.ok(!result.includes('# Old generated content'));
  });

  it('appends marked content when existing file has no markers', () => {
    const existing = '# My Custom Rules\n\nSome hand-written content.\n';

    const result = mergeMarkedContent(existing, newBlock);

    assert.ok(result.startsWith('# My Custom Rules\n'));
    assert.ok(result.includes(MARKER_BEGIN));
    assert.ok(result.includes(newBlock));
    assert.ok(result.includes(MARKER_END));
  });

  it('preserves content before and after markers', () => {
    const before = '# Before Section\n\nContent before markers.\n\n';
    const after = '\n# After Section\n\nContent after markers.\n';
    const existing = `${before}${MARKER_BEGIN}\n# Old content\n${MARKER_END}${after}`;

    const result = mergeMarkedContent(existing, newBlock);

    assert.ok(result.startsWith('# Before Section'));
    assert.ok(result.includes('Content before markers.'));
    assert.ok(result.includes(newBlock));
    assert.ok(result.includes('# After Section'));
    assert.ok(result.includes('Content after markers.'));
    assert.ok(!result.includes('# Old content'));
  });

  it('handles empty new block', () => {
    const result = mergeMarkedContent(null, '');
    assert.equal(result, `${MARKER_BEGIN}\n${MARKER_END}\n`);
  });
});

describe('removeMarkedBlock', () => {
  it('removes marker block and returns remaining content', () => {
    const existing = `# My Rules\n\nCustom content.\n\n${MARKER_BEGIN}\n# Generated\n${MARKER_END}\n\n# Footer\n`;
    const result = removeMarkedBlock(existing);
    assert.ok(result.includes('# My Rules'));
    assert.ok(result.includes('Custom content.'));
    assert.ok(result.includes('# Footer'));
    assert.ok(!result.includes(MARKER_BEGIN));
    assert.ok(!result.includes(MARKER_END));
    assert.ok(!result.includes('# Generated'));
  });

  it('returns empty string when file is only markers', () => {
    const existing = `${MARKER_BEGIN}\n# Generated\n${MARKER_END}\n`;
    const result = removeMarkedBlock(existing);
    assert.equal(result, '');
  });

  it('returns content unchanged when no markers present', () => {
    const existing = '# My Rules\n\nCustom content.';
    const result = removeMarkedBlock(existing);
    assert.equal(result, existing);
  });
});
