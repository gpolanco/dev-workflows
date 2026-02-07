import type { Rule } from '../bridges/types.js';

export function filterRules(rules: Rule[]): Rule[] {
  return rules.filter((r) => r.enabled && r.severity !== 'info');
}

export function groupByScope(rules: Rule[]): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>();
  for (const rule of rules) {
    const existing = groups.get(rule.scope);
    if (existing) {
      existing.push(rule);
    } else {
      groups.set(rule.scope, [rule]);
    }
  }
  return groups;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
