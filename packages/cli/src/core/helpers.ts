import type { Rule } from '../bridges/types.js';
import { BUILTIN_SCOPES, isBuiltinScope } from './schema.js';

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

  // Sort: built-in scopes first (in canonical order), then custom alphabetically
  const sorted = new Map<string, Rule[]>();

  for (const builtin of BUILTIN_SCOPES) {
    const entries = groups.get(builtin);
    if (entries) {
      sorted.set(builtin, entries);
    }
  }

  const customScopes = [...groups.keys()]
    .filter((s) => !isBuiltinScope(s))
    .sort();
  for (const scope of customScopes) {
    const entries = groups.get(scope);
    if (entries) {
      sorted.set(scope, entries);
    }
  }

  return sorted;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatScopeHeading(scope: string): string {
  return isBuiltinScope(scope) ? capitalize(scope) : scope;
}
