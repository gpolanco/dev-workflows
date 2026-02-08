import type { Bridge, Rule, ProjectConfig } from './types.js';
import { filterRules, groupByScope, formatScopeHeading } from '../core/helpers.js';

function buildMarkdown(rules: Rule[]): string {
  const lines: string[] = [
    '# Project Rules',
  ];

  const filtered = filterRules(rules);
  const grouped = groupByScope(filtered);

  for (const [scope, scopeRules] of grouped) {
    lines.push('', `## ${formatScopeHeading(scope)}`);
    for (const rule of scopeRules) {
      const contentLines = rule.content.split('\n');
      const first = contentLines[0];
      if (first !== undefined) {
        lines.push('', `- ${first}`);
      }
      for (let i = 1; i < contentLines.length; i++) {
        const line = contentLines[i];
        if (line !== undefined) {
          lines.push(`  ${line}`);
        }
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

export const claudeBridge: Bridge = {
  id: 'claude',
  outputPaths: ['CLAUDE.md'],
  usesMarkers: true,

  compile(rules: Rule[], _config: ProjectConfig): Map<string, string> {
    const output = new Map<string, string>();
    output.set('CLAUDE.md', buildMarkdown(rules));
    return output;
  },
};
