import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidScope,
  isBuiltinScope,
  isValidTrigger,
  BUILTIN_SCOPES,
  VALID_TOOL_IDS,
  VALID_TRIGGERS,
  VALID_CONFIG_VERSIONS,
  validateScopeMetadata,
} from '../../src/core/schema.js';

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

describe('VALID_CONFIG_VERSIONS', () => {
  it('contains 0.1 and 0.2', () => {
    assert.deepEqual([...VALID_CONFIG_VERSIONS], ['0.1', '0.2']);
  });
});

describe('VALID_TRIGGERS', () => {
  it('contains always, glob, and manual', () => {
    assert.deepEqual([...VALID_TRIGGERS], ['always', 'glob', 'manual']);
  });
});

describe('isValidTrigger', () => {
  it('returns true for valid triggers', () => {
    assert.equal(isValidTrigger('always'), true);
    assert.equal(isValidTrigger('glob'), true);
    assert.equal(isValidTrigger('manual'), true);
  });

  it('returns false for invalid triggers', () => {
    assert.equal(isValidTrigger('invalid'), false);
    assert.equal(isValidTrigger('auto'), false);
    assert.equal(isValidTrigger(''), false);
  });
});

describe('validateScopeMetadata', () => {
  it('returns valid metadata with globs array', () => {
    const result = validateScopeMetadata({ globs: ['**/*.ts', '**/*.tsx'] });
    assert.equal(result.errors.length, 0);
    assert.ok(result.metadata);
    assert.deepEqual(result.metadata?.globs, ['**/*.ts', '**/*.tsx']);
  });

  it('returns valid metadata with paths array', () => {
    const result = validateScopeMetadata({ paths: ['src/', 'lib/'] });
    assert.equal(result.errors.length, 0);
    assert.ok(result.metadata);
    assert.deepEqual(result.metadata?.paths, ['src/', 'lib/']);
  });

  it('returns valid metadata with trigger value', () => {
    const result = validateScopeMetadata({ trigger: 'always' });
    assert.equal(result.errors.length, 0);
    assert.ok(result.metadata);
    assert.equal(result.metadata?.trigger, 'always');
  });

  it('returns undefined metadata for empty input', () => {
    const result = validateScopeMetadata({});
    assert.equal(result.errors.length, 0);
    assert.equal(result.metadata, undefined);
  });

  it('rejects non-array globs', () => {
    const result = validateScopeMetadata({ globs: '**/*.ts' });
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0]?.field === 'globs');
  });

  it('rejects non-string items in globs array', () => {
    const result = validateScopeMetadata({ globs: [123, true] });
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0]?.field === 'globs');
  });

  it('rejects non-array paths', () => {
    const result = validateScopeMetadata({ paths: 'src/' });
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0]?.field === 'paths');
  });

  it('rejects invalid trigger value', () => {
    const result = validateScopeMetadata({ trigger: 'invalid' });
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0]?.field === 'trigger');
    assert.ok(result.errors[0]?.message.includes('invalid'));
  });

  it('validates all fields together', () => {
    const result = validateScopeMetadata({
      globs: ['**/*.ts'],
      paths: ['src/'],
      trigger: 'glob',
    });
    assert.equal(result.errors.length, 0);
    assert.ok(result.metadata);
    assert.deepEqual(result.metadata?.globs, ['**/*.ts']);
    assert.deepEqual(result.metadata?.paths, ['src/']);
    assert.equal(result.metadata?.trigger, 'glob');
  });

  it('reports multiple errors at once', () => {
    const result = validateScopeMetadata({
      globs: 'not-an-array',
      trigger: 'invalid',
    });
    assert.equal(result.errors.length, 2);
  });
});
