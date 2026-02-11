import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../../src/core/converter.js';

function ruleAt(result: ReturnType<typeof convert>, index: number) {
  const rule = result.rules[index];
  if (!rule) throw new Error(`No rule at index ${String(index)}`);
  return rule;
}

const VALID_MD = `---
name: react
description: "React conventions for AI coding agents"
version: "0.1.0"
scope: conventions
tags: [react, frontend]
---

## Components

- Always use named exports. Never use default exports.
  This applies to all files: components, utilities, hooks, and types.

- Use PascalCase for component files (\`UserProfile.tsx\`).

## Hooks

- Never call hooks conditionally. Always call hooks at the top
  level of your component or custom hook.

- Prefix custom hooks with \`use\` (\`useAuth.ts\`).

## General

- Colocate related files: component, hook, utils, and types
  in the same feature folder.
`;

describe('converter', () => {
  describe('frontmatter parsing', () => {
    it('extracts name, description, version, scope, tags', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      assert.equal(result.name, 'react');
      assert.equal(result.description, 'React conventions for AI coding agents');
      assert.equal(result.version, '0.1.0');
      assert.equal(result.scope, 'conventions');
      assert.deepEqual(result.tags, ['react', 'frontend']);
    });

    it('throws on missing frontmatter', () => {
      assert.throws(() => convert('# No frontmatter', 'a', 'b'), /missing YAML frontmatter/);
    });

    it('throws on missing name', () => {
      const md = `---
description: "test"
version: "0.1.0"
scope: conventions
---

- rule
`;
      assert.throws(() => convert(md, 'a', 'b'), /missing "name"/);
    });

    it('throws on missing description', () => {
      const md = `---
name: test
version: "0.1.0"
scope: conventions
---

- rule
`;
      assert.throws(() => convert(md, 'a', 'b'), /missing "description"/);
    });

    it('throws on invalid scope', () => {
      const md = `---
name: test
description: "test"
version: "0.1.0"
scope: INVALID
---

- rule
`;
      assert.throws(() => convert(md, 'a', 'b'), /invalid scope/);
    });
  });

  describe('bullet extraction', () => {
    it('extracts first-level bullets as individual rules', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      assert.equal(result.rules.length, 5);
    });

    it('handles indented continuation as part of the same rule', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      const first = ruleAt(result, 0);
      assert.ok(first.content.includes('Always use named exports'));
      assert.ok(first.content.includes('This applies to all files'));
    });

    it('extracts single-line bullets correctly', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      const second = ruleAt(result, 1);
      assert.ok(second.content.includes('PascalCase'));
    });
  });

  describe('ID generation with headings', () => {
    it('generates IDs with heading slug', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      assert.equal(ruleAt(result, 0).id, 'pulled-javascript-react-components-0');
      assert.equal(ruleAt(result, 1).id, 'pulled-javascript-react-components-1');
      assert.equal(ruleAt(result, 2).id, 'pulled-javascript-react-hooks-0');
      assert.equal(ruleAt(result, 3).id, 'pulled-javascript-react-hooks-1');
      assert.equal(ruleAt(result, 4).id, 'pulled-javascript-react-general-0');
    });

    it('resets index per heading', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      assert.equal(ruleAt(result, 2).id, 'pulled-javascript-react-hooks-0');
      assert.equal(ruleAt(result, 4).id, 'pulled-javascript-react-general-0');
    });
  });

  describe('ID generation without headings', () => {
    it('generates IDs without heading segment when no headings exist', () => {
      const md = `---
name: simple
description: "Simple rules"
version: "0.1.0"
scope: conventions
---

- First rule content.

- Second rule content.

- Third rule content.
`;
      const result = convert(md, 'typescript', 'simple');
      assert.equal(ruleAt(result, 0).id, 'pulled-typescript-simple-0');
      assert.equal(ruleAt(result, 1).id, 'pulled-typescript-simple-1');
      assert.equal(ruleAt(result, 2).id, 'pulled-typescript-simple-2');
    });
  });

  describe('multiline bullets', () => {
    it('handles multi-line continuation correctly', () => {
      const md = `---
name: multi
description: "Multiline test"
version: "0.1.0"
scope: conventions
---

- First line of rule.
  Second line of rule.
  Third line of rule.

- Another rule.
`;
      const result = convert(md, 'test', 'multi');
      assert.equal(result.rules.length, 2);
      assert.ok(ruleAt(result, 0).content.includes('First line'));
      assert.ok(ruleAt(result, 0).content.includes('Second line'));
      assert.ok(ruleAt(result, 0).content.includes('Third line'));
    });
  });

  describe('rule properties', () => {
    it('all rules have severity error', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      for (const rule of result.rules) {
        assert.equal(rule.severity, 'error');
      }
    });

    it('all rules inherit tags from frontmatter', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      for (const rule of result.rules) {
        assert.deepEqual(rule.tags, ['react', 'frontend']);
      }
    });

    it('all rules have source set to category/name', () => {
      const result = convert(VALID_MD, 'javascript', 'react');
      for (const rule of result.rules) {
        assert.equal(rule.source, 'javascript/react');
      }
    });
  });
});
