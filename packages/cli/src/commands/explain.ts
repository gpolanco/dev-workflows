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
import * as ui from '../utils/ui.js';
import { ICONS } from '../utils/ui.js';

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
    return 'markers (BEGIN/END)';
  }
  return 'full file';
}

function getExcludedRules(rules: Rule[]): Array<{ id: string; reason: string }> {
  const excluded: Array<{ id: string; reason: string }> = [];

  for (const rule of rules) {
    if (rule.severity === 'info') {
      excluded.push({ id: rule.id, reason: `severity: info ${ICONS.arrow} excluded from output` });
    } else if (!rule.enabled) {
      excluded.push({ id: rule.id, reason: 'enabled: false' });
    }
  }

  return excluded;
}

function formatSeparator(toolId: string): string {
  const label = ` ${toolId} `;
  const lineWidth = 40;
  const prefix = `${ICONS.separator}${ICONS.separator}`;
  const remaining = lineWidth - prefix.length - label.length;
  const suffix = ICONS.separator.repeat(Math.max(0, remaining));
  return chalk.dim(`${prefix}${label}${suffix}`);
}

async function runExplain(options: ExplainOptions): Promise<void> {
  const cwd = process.cwd();

  if (!(await fileExists(join(cwd, '.dwf', 'config.yml')))) {
    ui.error('.dwf/config.yml not found', 'Run devw init to initialize the project');
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(cwd);
  const rules = await readRules(cwd);

  let toolIds = config.tools;
  if (options.tool) {
    if (!config.tools.includes(options.tool)) {
      ui.error(`Tool "${options.tool}" is not configured in .dwf/config.yml`, `Configured tools: ${config.tools.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    toolIds = [options.tool];
  }

  for (const toolId of toolIds) {
    const bridge = getBridge(toolId);
    if (!bridge) continue;

    const outputPath = bridge.outputPaths[0] ?? toolId;

    console.log(`  ${formatSeparator(toolId)}`);
    ui.newline();
    ui.keyValue('Output:', outputPath);
    ui.keyValue('Mode:', getModeLabel(bridge));

    const included = filterRules(rules);
    const grouped = groupByScope(included);

    ui.keyValue('Rules:', `${String(included.length)} included`);
    for (const [scope, scopeRules] of grouped) {
      console.log(`    ${' '.repeat(10)}${scope}: ${String(scopeRules.length)}`);
    }

    const excluded = getExcludedRules(rules);
    ui.newline();
    ui.keyValue('Excluded:', String(excluded.length));
    if (excluded.length > 0) {
      for (const entry of excluded) {
        const label = rules.find((r) => r.id === entry.id)?.severity === 'info' ? 'info' : 'disabled';
        console.log(`    ${' '.repeat(10)}[${label}] ${entry.id}`);
      }
    }

    if (bridge.id === 'windsurf') {
      const outputs = bridge.compile(rules, config);
      const content = outputs.get('.windsurf/rules/devworkflows.md') ?? '';
      const charCount = content.length;
      const formatted = `${String(charCount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} / ${String(WINDSURF_CHAR_LIMIT).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} chars`;
      ui.newline();
      if (charCount > WINDSURF_CHAR_LIMIT) {
        ui.warn(`Output size: ${formatted} (Windsurf limit)`);
      } else {
        ui.keyValue('Size:', `${formatted} (Windsurf limit)`);
      }
    }

    ui.newline();
  }
}

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Show what each configured editor will receive and why')
    .option('--tool <tool>', 'Explain only a specific tool')
    .action((options: ExplainOptions) => runExplain(options));
}
