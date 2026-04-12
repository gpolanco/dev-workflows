import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchRegistry, filterRegistryByTag } from '../../src/utils/registry.js';
import type { Registry } from '../../src/utils/registry.js';

function makeRegistry(rules: Array<{ path: string; name: string; description: string; tags: string[] }>): Registry {
  return {
    version: 1,
    generated_at: '2026-04-12T00:00:00Z',
    rules: rules.map((r) => ({
      ...r,
      version: '0.1.0',
      scope: 'conventions',
      size_bytes: 100,
    })),
    assets: { commands: [], templates: [], hooks: [], presets: [] },
  };
}

const SAMPLE_REGISTRY = makeRegistry([
  { path: 'typescript/strict', name: 'Strict TypeScript', description: 'Enforce strict TypeScript conventions', tags: ['typescript', 'strict', 'types'] },
  { path: 'typescript/react', name: 'React TypeScript', description: 'TypeScript patterns for React components', tags: ['typescript', 'react', 'frontend'] },
  { path: 'security/supabase-rls', name: 'Supabase RLS', description: 'Row-level security policies for Supabase', tags: ['security', 'supabase', 'rls'] },
  { path: 'testing/unit', name: 'Unit Testing', description: 'Best practices for unit testing', tags: ['testing', 'jest', 'vitest'] },
  { path: 'workflow/git', name: 'Git Workflow', description: 'Git branching and commit conventions', tags: ['git', 'workflow'] },
]);

describe('searchRegistry', () => {
  it('returns all rules for empty query', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, '');
    assert.equal(results.length, 5);
  });

  it('returns all rules for whitespace-only query', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, '   ');
    assert.equal(results.length, 5);
  });

  it('matches by name', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'Supabase');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'security/supabase-rls');
  });

  it('matches by description', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'branching');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'workflow/git');
  });

  it('matches by path', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'typescript/strict');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'typescript/strict');
  });

  it('matches by tag', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'vitest');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'testing/unit');
  });

  it('is case-insensitive', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'SUPABASE');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'security/supabase-rls');
  });

  it('supports multi-term AND search', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'typescript react');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'typescript/react');
  });

  it('returns empty when no terms match', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'python django');
    assert.equal(results.length, 0);
  });

  it('returns empty when only one of AND terms matches', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'typescript django');
    assert.equal(results.length, 0);
  });

  it('matches multiple rules', () => {
    const results = searchRegistry(SAMPLE_REGISTRY, 'typescript');
    assert.equal(results.length, 2);
    const paths = results.map((r) => r.path);
    assert.ok(paths.includes('typescript/strict'));
    assert.ok(paths.includes('typescript/react'));
  });

  it('handles empty registry', () => {
    const empty = makeRegistry([]);
    const results = searchRegistry(empty, 'anything');
    assert.equal(results.length, 0);
  });
});

describe('filterRegistryByTag', () => {
  it('returns all rules for empty tag', () => {
    const results = filterRegistryByTag(SAMPLE_REGISTRY, '');
    assert.equal(results.length, 5);
  });

  it('returns all rules for whitespace-only tag', () => {
    const results = filterRegistryByTag(SAMPLE_REGISTRY, '   ');
    assert.equal(results.length, 5);
  });

  it('filters by exact tag match', () => {
    const results = filterRegistryByTag(SAMPLE_REGISTRY, 'security');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'security/supabase-rls');
  });

  it('is case-insensitive', () => {
    const results = filterRegistryByTag(SAMPLE_REGISTRY, 'REACT');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.path, 'typescript/react');
  });

  it('returns multiple matches', () => {
    const results = filterRegistryByTag(SAMPLE_REGISTRY, 'typescript');
    assert.equal(results.length, 2);
  });

  it('returns empty for non-existent tag', () => {
    const results = filterRegistryByTag(SAMPLE_REGISTRY, 'python');
    assert.equal(results.length, 0);
  });

  it('does not partial-match tags', () => {
    const results = filterRegistryByTag(SAMPLE_REGISTRY, 'type');
    assert.equal(results.length, 0);
  });

  it('handles empty registry', () => {
    const empty = makeRegistry([]);
    const results = filterRegistryByTag(empty, 'anything');
    assert.equal(results.length, 0);
  });
});
