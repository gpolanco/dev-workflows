import type { Rule } from '../bridges/types.js';

export function mergeRules(globalRules: Rule[], projectRules: Rule[]): Rule[] {
  const projectRuleIds = new Set<string>(projectRules.map((rule) => rule.id));
  const mergedGlobalRules = globalRules.filter((rule) => !projectRuleIds.has(rule.id));

  return [...mergedGlobalRules, ...projectRules];
}
