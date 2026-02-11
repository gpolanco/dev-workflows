import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../../src/core/converter.js';

function ruleAt(result: ReturnType<typeof convert>, index: number) {
  const rule = result.rules[index];
  if (!rule) throw new Error(`No rule at index ${String(index)}`);
  return rule;
}

function md(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

const BASE_FM = `name: test
description: "Test rules"
version: "0.1.0"
scope: conventions`;

describe('converter edge cases', () => {
  describe('empty / minimal body', () => {
    it('returns 0 rules when body is empty (only frontmatter)', () => {
      const result = convert(md(BASE_FM, ''), 'cat', 'name');
      assert.equal(result.rules.length, 0);
    });

    it('returns 0 rules when body has only headings without bullets', () => {
      const result = convert(md(BASE_FM, '\n## Heading One\n\n## Heading Two\n'), 'cat', 'name');
      assert.equal(result.rules.length, 0);
    });
  });

  describe('frontmatter defaults and coercion', () => {
    it('defaults version to "0.1.0" when version is a number', () => {
      const fm = `name: test
description: "Test"
version: 1
scope: conventions`;
      const result = convert(md(fm, '\n- rule\n'), 'cat', 'name');
      assert.equal(result.version, '0.1.0');
    });

    it('defaults tags to [] when tags is a string', () => {
      const fm = `name: test
description: "Test"
version: "0.1.0"
scope: conventions
tags: "not-an-array"`;
      const result = convert(md(fm, '\n- rule\n'), 'cat', 'name');
      assert.deepEqual(result.tags, []);
    });

    it('filters non-string items in tags array', () => {
      const fm = `name: test
description: "Test"
version: "0.1.0"
scope: conventions
tags: [valid, 123, true]`;
      const result = convert(md(fm, '\n- rule\n'), 'cat', 'name');
      assert.deepEqual(result.tags, ['valid']);
    });
  });

  describe('frontmatter error cases', () => {
    it('throws "not an object" when frontmatter is a scalar string', () => {
      const raw = `---\njust a string\n---\n- rule`;
      assert.throws(() => convert(raw, 'cat', 'name'), /not an object/);
    });

    it('throws "missing name" when frontmatter is a YAML array', () => {
      const raw = `---\n- item1\n- item2\n---\n- rule`;
      assert.throws(() => convert(raw, 'cat', 'name'), /missing "name"/);
    });
  });

  describe('bullets before and after headings', () => {
    it('assigns no heading segment to bullets before any heading', () => {
      const body = `
- orphan bullet

## Section

- section bullet
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(result.rules.length, 2);
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-0');
      assert.ok(!ruleAt(result, 0).id.includes('section'));
    });

    it('assigns correct IDs for mix of bullets before and after heading', () => {
      const body = `
- before heading

## My Section

- after heading
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-0');
      assert.equal(ruleAt(result, 1).id, 'pulled-cat-name-my-section-0');
    });
  });

  describe('heading slug via toKebabCase', () => {
    it('converts heading with special characters to kebab-case', () => {
      const body = `
## Type Safety & Best Practices!

- rule
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-type-safety-best-practices-0');
    });

    it('handles heading with leading/trailing special chars', () => {
      const body = `
## ---Leading Trailing---

- rule
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-leading-trailing-0');
    });

    it('handles heading with numbers', () => {
      const body = `
## Rule 42 Tips

- rule
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-rule-42-tips-0');
    });

    it('collapses consecutive hyphens in heading slug', () => {
      const body = `
## Foo   ---   Bar

- rule
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-foo-bar-0');
    });

    it('handles heading made entirely of symbols (empty slug is falsy → no heading segment)', () => {
      const body = `
## @#$%^&*

- rule
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      // toKebabCase("@#$%^&*") → "" (falsy) → headingPart = "" → no heading segment in ID
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-0');
    });
  });

  describe('bullet edge cases', () => {
    it('captures empty bullet content ("- " with trailing space, no text)', () => {
      // Must be "- " (dash + space) to match startsWith('- ')
      const raw = md(BASE_FM, '\n- \n');
      const result = convert(raw, 'cat', 'name');
      assert.equal(result.rules.length, 1);
      assert.equal(ruleAt(result, 0).content, '');
    });

    it('bare dash without space is not a bullet', () => {
      const body = `\n-\n`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(result.rules.length, 0);
    });

    it('h3 (###) does not act as heading separator', () => {
      const body = `
## Real Heading

- bullet one

### Not A Heading

- bullet two
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      // ### flushes the current bullet (non-bullet line), but both bullets share the same h2 heading
      assert.equal(ruleAt(result, 0).id, 'pulled-cat-name-real-heading-0');
      assert.equal(ruleAt(result, 1).id, 'pulled-cat-name-real-heading-1');
    });

    it('flushes current bullet when non-bullet text appears after it', () => {
      const body = `
- bullet content
Some plain text paragraph
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(result.rules.length, 1);
      assert.equal(ruleAt(result, 0).content, 'bullet content');
    });

    it('\\r\\n line endings break frontmatter parsing (known limitation)', () => {
      const raw = `---\r\n${BASE_FM}\r\n---\r\n\r\n## Section\r\n\r\n- bullet one\r\n- bullet two\r\n`;
      // Frontmatter regex requires \n, so \r\n causes "missing YAML frontmatter"
      assert.throws(() => convert(raw, 'cat', 'name'), /missing YAML frontmatter/);
    });

    it('\\r\\n in body only (\\n in frontmatter) extracts bullets with \\r trimmed', () => {
      const body = '\r\n## Section\r\n\r\n- bullet one\r\n- bullet two\r\n';
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(result.rules.length, 2);
    });

    it('multiple empty lines between bullets do not break accumulation', () => {
      const body = `
- first bullet


- second bullet



- third bullet
`;
      const result = convert(md(BASE_FM, body), 'cat', 'name');
      assert.equal(result.rules.length, 3);
    });
  });
});
