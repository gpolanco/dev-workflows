import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { readConfig, readRules } from '../core/parser.js';
import type { Bridge, Rule } from '../bridges/types.js';
import { claudeBridge } from '../bridges/claude.js';
import { cursorBridge } from '../bridges/cursor.js';
import { geminiBridge } from '../bridges/gemini.js';
import { windsurfBridge } from '../bridges/windsurf.js';
import { copilotBridge } from '../bridges/copilot.js';
import { filterRules, groupByScope } from '../core/helpers.js';
import { fileExists } from '../utils/fs.js';

const WINDSURF_CHAR_LIMIT = 6000;

export interface ExplainOptions {
  tool?: string;
}

const BRIDGES: Bridge[] = [claudeBridge, cursorBridge, geminiBridge, windsurfBridge, copilotBridge];

function getBridge(id: string): Bridge | undefined {
  return BRIDGES.find((b) => b.id === id);
}

function getModeLabel(bridge: Bridge): string {
  if (bridge.usesMarkers) {
    return 'copy (with BEGIN/END markers)';
  }
  return 'copy (full file, no markers)';
}

function getExcludedRules(rules: Rule[]): Array<{ id: string; reason: string }> {
  const excluded: Array<{ id: string; reason: string }> = [];

  for (const rule of rules) {
    if (rule.severity === 'info') {
      excluded.push({ id: rule.id, reason: `severity: info \u2192 excluded from output` });
    } else if (!rule.enabled) {
      excluded.push({ id: rule.id, reason: 'enabled: false' });
    }
  }

  return excluded;
}

async function runExplain(options: ExplainOptions): Promise<void> {
  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    console.error(chalk.red('Error: .dwf/config.yml not found.'));
    console.error('Run "devw init" first.');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);
  const rules = await readRules(cwd);

  let toolIds = config.tools;
  if (options.tool) {
    if (!config.tools.includes(options.tool)) {
      console.error(chalk.red(`Error: tool "${options.tool}" is not configured in .dwf/config.yml`));
      console.error(`Configured tools: ${config.tools.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    toolIds = [options.tool];
  }

  for (const toolId of toolIds) {
    const bridge = getBridge(toolId);
    if (!bridge) continue;

    const outputPath = bridge.outputPaths[0] ?? toolId;

    console.log(`\u2550\u2550\u2550 ${toolId} \u2550\u2550\u2550`);
    console.log(`Output: ${outputPath}`);
    console.log(`Mode: ${getModeLabel(bridge)}`);

    const included = filterRules(rules);
    const grouped = groupByScope(included);

    console.log(`Rules included: ${String(included.length)}`);
    for (const [scope, scopeRules] of grouped) {
      console.log(`  ${scope}: ${String(scopeRules.length)} rules`);
    }

    const excluded = getExcludedRules(rules);
    if (excluded.length > 0) {
      console.log(`Rules excluded: ${String(excluded.length)}`);
      for (const entry of excluded) {
        const label = rules.find((r) => r.id === entry.id)?.severity === 'info' ? 'info' : 'disabled';
        console.log(`  - [${label}] ${entry.id} (${entry.reason})`);
      }
    }

    if (bridge.id === 'windsurf') {
      const outputs = bridge.compile(rules, config);
      const content = outputs.get('.windsurf/rules/devworkflows.md') ?? '';
      const charCount = content.length;
      if (charCount > WINDSURF_CHAR_LIMIT) {
        console.log(chalk.yellow(`\u26A0 Output size: ${String(charCount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} / ${String(WINDSURF_CHAR_LIMIT).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} chars (Windsurf limit)`));
      } else {
        console.log(`Output size: ${String(charCount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} / ${String(WINDSURF_CHAR_LIMIT).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} chars (Windsurf limit)`);
      }
    }

    console.log('');
  }
}

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Show what each configured editor will receive and why')
    .option('--tool <tool>', 'Explain only a specific tool')
    .action((options: ExplainOptions) => runExplain(options));
}
