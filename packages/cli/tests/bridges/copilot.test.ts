import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { copilotBridge } from '../../src/bridges/copilot.js';
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
  tools: ['copilot'],
  mode: 'copy',
  blocks: [],
};

describe('copilotBridge', () => {
  it('has correct id', () => {
    assert.equal(copilotBridge.id, 'copilot');
  });

  it('has correct output path', () => {
    assert.deepEqual(copilotBridge.outputPaths, ['.github/copilot-instructions.md']);
  });

  it('uses markers', () => {
    assert.equal(copilotBridge.usesMarkers, true);
  });

  it('generates correct markdown output', () => {
    const rules = [
      makeRule({ id: 'rule-a', scope: 'architecture', content: 'Use named exports.' }),
      makeRule({ id: 'rule-b', scope: 'conventions', content: 'Use kebab-case.' }),
    ];

    const output = copilotBridge.compile(rules, CONFIG);
    const content = output.get('.github/copilot-instructions.md');

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

    const output = copilotBridge.compile(rules, CONFIG);
    const content = output.get('.github/copilot-instructions.md') ?? '';

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

    const output = copilotBridge.compile(rules, CONFIG);
    const content = output.get('.github/copilot-instructions.md') ?? '';

    assert.ok(content.includes('## team:payments'));
    assert.ok(!content.includes('## Team:payments'));
  });

  it('filters out info and disabled rules', () => {
    const rules = [
      makeRule({ id: 'rule-a', scope: 'architecture', content: 'Keep this.' }),
      makeRule({ id: 'rule-b', scope: 'architecture', severity: 'info', content: 'Skip info.' }),
      makeRule({ id: 'rule-c', scope: 'architecture', enabled: false, content: 'Skip disabled.' }),
    ];

    const output = copilotBridge.compile(rules, CONFIG);
    const content = output.get('.github/copilot-instructions.md') ?? '';

    assert.ok(content.includes('Keep this.'));
    assert.ok(!content.includes('Skip info.'));
    assert.ok(!content.includes('Skip disabled.'));
  });
});
