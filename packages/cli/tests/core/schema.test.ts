import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidScope, isBuiltinScope, BUILTIN_SCOPES, VALID_TOOL_IDS } from '../../src/core/schema.js';

describe('isValidScope', () => {
  it('accepts built-in scopes', () => {
    for (const scope of BUILTIN_SCOPES) {
      assert.equal(isValidScope(scope), true, `should accept built-in scope "${scope}"`);
    }
  });

  it('accepts custom scopes with kind:name pattern', () => {
    const valid = ['team:payments', 'agent:reviewer', 'pipeline:ci', 'org:my-team', 'a:b'];
    for (const scope of valid) {
      assert.equal(isValidScope(scope), true, `should accept custom scope "${scope}"`);
    }
  });

  it('accepts simple lowercase scopes', () => {
    const valid = ['myscope', 'custom', 'a', 'scope2'];
    for (const scope of valid) {
      assert.equal(isValidScope(scope), true, `should accept simple scope "${scope}"`);
    }
  });

  it('rejects uppercase in kind', () => {
    assert.equal(isValidScope('Team:payments'), false);
  });

  it('rejects uppercase in name', () => {
    assert.equal(isValidScope('team:Pay'), false);
  });

  it('rejects trailing colon', () => {
    assert.equal(isValidScope('team:'), false);
  });

  it('rejects leading colon', () => {
    assert.equal(isValidScope(':name'), false);
  });

  it('rejects spaces', () => {
    assert.equal(isValidScope('team:with spaces'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isValidScope(''), false);
  });

  it('rejects scope starting with number', () => {
    assert.equal(isValidScope('1scope'), false);
  });

  it('allows hyphens in name but not in kind', () => {
    assert.equal(isValidScope('team:my-scope'), true);
    assert.equal(isValidScope('my-team:scope'), false);
  });
});

describe('isBuiltinScope', () => {
  it('returns true for built-in scopes', () => {
    for (const scope of BUILTIN_SCOPES) {
      assert.equal(isBuiltinScope(scope), true);
    }
  });

  it('returns false for custom scopes', () => {
    assert.equal(isBuiltinScope('team:payments'), false);
    assert.equal(isBuiltinScope('custom'), false);
  });
});

describe('BUILTIN_SCOPES', () => {
  it('contains the 5 original scopes', () => {
    assert.deepEqual([...BUILTIN_SCOPES], ['architecture', 'conventions', 'security', 'workflow', 'testing']);
  });
});

describe('VALID_TOOL_IDS', () => {
  it('contains all 5 tool IDs', () => {
    assert.deepEqual([...VALID_TOOL_IDS], ['claude', 'cursor', 'gemini', 'windsurf', 'copilot']);
  });
});
