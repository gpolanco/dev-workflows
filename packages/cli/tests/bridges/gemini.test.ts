import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { geminiBridge } from '../../src/bridges/gemini.js';
import { isMarkerBridge, isDirectoryBridge } from '../../src/bridges/types.js';
import type { Rule, ProjectConfig } from '../../src/bridges/types.js';

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'test-rule',
    scope: 'architecture',
    severity: 'error',
    content: 'Test content',
    enabled: true,
    ...overrides,
  };
}

const CONFIG: ProjectConfig = {
  version: '0.1',
  project: { name: 'test' },
  tools: ['gemini'],
  mode: 'copy',
  blocks: [],
  pulled: [],
  assets: [],
};

describe('geminiBridge', () => {
  it('has correct id', () => {
    assert.equal(geminiBridge.id, 'gemini');
  });

  it('has kind marker', () => {
    assert.equal(geminiBridge.kind, 'marker');
  });

  it('has correct output path', () => {
    assert.deepEqual(geminiBridge.outputPaths, ['GEMINI.md']);
  });

  it('uses markers', () => {
    assert.equal(geminiBridge.usesMarkers, true);
  });

  it('is identified as MarkerBridge by type guard', () => {
    assert.equal(isMarkerBridge(geminiBridge), true);
    assert.equal(isDirectoryBridge(geminiBridge), false);
  });

  it('generates correct markdown output', () => {
    const rules = [
      makeRule({ id: 'rule-a', scope: 'architecture', content: 'Use named exports.' }),
      makeRule({ id: 'rule-b', scope: 'conventions', content: 'Use kebab-case.' }),
    ];

    const output = geminiBridge.compile(rules, CONFIG);
    const content = output.get('GEMINI.md');

    assert.ok(content);
    assert.ok(content.includes('# Project Rules'));
    assert.ok(content.includes('## Architecture'));
    assert.ok(content.includes('- Use named exports.'));
    assert.ok(content.includes('## Conventions'));
    assert.ok(content.includes('- Use kebab-case.'));
  });

  it('sorts scopes: built-in first, then custom alphabetically', () => {
    const rules = [
      makeRule({ id: 'rule-z', scope: 'team:payments', content: 'No raw SQL.' }),
      makeRule({ id: 'rule-a', scope: 'architecture', content: 'Named exports.' }),
      makeRule({ id: 'rule-b', scope: 'conventions', content: 'Kebab case.' }),
    ];

    const output = geminiBridge.compile(rules, CONFIG);
    const content = output.get('GEMINI.md') ?? '';

    const archIndex = content.indexOf('## Architecture');
    const convIndex = content.indexOf('## Conventions');
    const teamIndex = content.indexOf('## team:payments');

    assert.ok(archIndex < convIndex, 'Architecture should come before Conventions');
    assert.ok(convIndex < teamIndex, 'Conventions should come before team:payments');
  });

  it('renders custom scopes without capitalization', () => {
    const rules = [
      makeRule({ id: 'rule-a', scope: 'team:payments', content: 'No raw SQL.' }),
    ];

    const output = geminiBridge.compile(rules, CONFIG);
    const content = output.get('GEMINI.md') ?? '';

    assert.ok(content.includes('## team:payments'));
    assert.ok(!content.includes('## Team:payments'));
  });

  it('filters out info and disabled rules', () => {
    const rules = [
      makeRule({ id: 'rule-a', scope: 'architecture', content: 'Keep this.' }),
      makeRule({ id: 'rule-b', scope: 'architecture', severity: 'info', content: 'Skip info.' }),
      makeRule({ id: 'rule-c', scope: 'architecture', enabled: false, content: 'Skip disabled.' }),
    ];

    const output = geminiBridge.compile(rules, CONFIG);
    const content = output.get('GEMINI.md') ?? '';

    assert.ok(content.includes('Keep this.'));
    assert.ok(!content.includes('Skip info.'));
    assert.ok(!content.includes('Skip disabled.'));
  });
});
