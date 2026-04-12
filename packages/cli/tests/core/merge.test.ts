import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Rule } from '../../src/bridges/types.js';
import { mergeRules } from '../../src/core/merge.js';

function makeRule(id: string, content: string): Rule {
  return {
    id,
    scope: 'conventions',
    severity: 'error',
    content,
    enabled: true,
  };
}

describe('mergeRules', () => {
  it('includes global and project rules when there are no conflicts', () => {
    const globalRules = [
      makeRule('g1', 'global one'),
      makeRule('g2', 'global two'),
    ];
    const projectRules = [
      makeRule('p1', 'project one'),
      makeRule('p2', 'project two'),
    ];

    const merged = mergeRules(globalRules, projectRules);

    assert.deepEqual(merged.map((rule) => rule.id), ['g1', 'g2', 'p1', 'p2']);
  });

  it('prefers project rules when IDs conflict', () => {
    const globalRules = [
      makeRule('strict-types', 'global version'),
      makeRule('g2', 'global two'),
    ];
    const projectRules = [
      makeRule('strict-types', 'project version'),
      makeRule('p2', 'project two'),
    ];

    const merged = mergeRules(globalRules, projectRules);

    assert.equal(merged.length, 3);
    const strictTypes = merged.find((rule) => rule.id === 'strict-types');
    assert.ok(strictTypes);
    assert.equal(strictTypes.content, 'project version');
  });

  it('handles empty arrays', () => {
    assert.deepEqual(mergeRules([], []), []);
    assert.deepEqual(mergeRules([makeRule('g1', 'global')], []).map((rule) => rule.id), ['g1']);
    assert.deepEqual(mergeRules([], [makeRule('p1', 'project')]).map((rule) => rule.id), ['p1']);
  });
});
