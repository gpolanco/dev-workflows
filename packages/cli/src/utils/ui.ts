import chalk from 'chalk';

export const ICONS = {
  success: '\u2714',
  error: '\u2717',
  warn: '\u25B2',
  skip: '\u2013',
  bullet: '\u203A',
  dot: '\u00B7',
  arrow: '\u2192',
  dash: '\u2014',
  separator: '\u2500',
  reload: '\u27F3',
} as const;

const INDENT = {
  section: '  ',
  detail: '    ',
} as const;

export function success(msg: string): void {
  console.log(`${INDENT.section}${chalk.green(ICONS.success)} ${msg}`);
}

export function error(msg: string, hint?: string): void {
  console.error(`${INDENT.section}${chalk.red(ICONS.error)} ${chalk.red(msg)}`);
  if (hint) {
    console.error(`${INDENT.detail}${chalk.dim(hint)}`);
  }
}

export function warn(msg: string): void {
  console.log(`${INDENT.section}${chalk.yellow(ICONS.warn)} ${chalk.yellow(msg)}`);
}

export function info(msg: string): void {
  console.log(`${INDENT.section}${chalk.dim(msg)}`);
}

export function log(msg: string): void {
  console.log(msg);
}

export function header(title: string): void {
  console.log(`${INDENT.section}${chalk.bold(title)}`);
}

export function keyValue(label: string, value: string): void {
  const padded = label.padEnd(10);
  console.log(`${INDENT.detail}${chalk.dim(padded)}${value}`);
}

export function divider(): void {
  console.log(`${INDENT.section}${chalk.dim(`${ICONS.separator}${ICONS.separator}`)}`);
}

export function newline(): void {
  console.log('');
}

export function summary(counts: { passed?: number; failed?: number; skipped?: number }): void {
  const parts: string[] = [];
  const passed = counts.passed ?? 0;
  const failed = counts.failed ?? 0;
  const skipped = counts.skipped ?? 0;

  if (passed > 0 || (failed === 0 && skipped === 0)) {
    parts.push(chalk.green(`${String(passed)} passed`));
  }
  if (failed > 0 || (passed === 0 && skipped === 0)) {
    parts.push(chalk.red(`${String(failed)} failed`));
  }
  if (skipped > 0) {
    parts.push(chalk.dim(`${String(skipped)} skipped`));
  }

  console.log(`${INDENT.section}${parts.join(chalk.dim(` ${ICONS.dot} `))}`);
}

export function timing(ms: number): string {
  return chalk.dim(`(${String(Math.round(ms))}ms)`);
}

export function list(items: string[]): void {
  for (const item of items) {
    console.log(`${INDENT.detail}${chalk.dim(ICONS.bullet)} ${item}`);
  }
}

export function check(passed: boolean, msg: string, skipped?: boolean): void {
  if (skipped) {
    console.log(`${INDENT.section}${chalk.dim(ICONS.skip)} ${chalk.dim(msg)}`);
    return;
  }
  if (passed) {
    console.log(`${INDENT.section}${chalk.green(ICONS.success)} ${msg}`);
  } else {
    console.log(`${INDENT.section}${chalk.red(ICONS.error)} ${chalk.red(msg)}`);
  }
}
