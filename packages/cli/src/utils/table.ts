import pc from 'picocolors';

const INDENT = '  ';

function padCell(value: string, width: number): string {
  return value.padEnd(width, ' ');
}

function line(left: string, middle: string, right: string, widths: number[]): string {
  const segments = widths.map((width) => '─'.repeat(width + 2));
  return `${INDENT}${left}${segments.join(middle)}${right}`;
}

function inferWidths(headers: string[], rows: string[][], columnWidths?: number[]): number[] {
  return headers.map((header, index) => {
    const headerWidth = header.length;
    const rowWidth = rows.reduce((maxWidth, row) => {
      const value = row[index] ?? '';
      return Math.max(maxWidth, value.length);
    }, 0);
    const minWidth = columnWidths?.[index] ?? 0;
    return Math.max(headerWidth, rowWidth, minWidth);
  });
}

function renderRow(cells: string[], widths: number[], bold = false): string {
  const rendered = widths.map((width, index) => {
    const rawCell = cells[index] ?? '';
    const paddedCell = ` ${padCell(rawCell, width)} `;
    return bold ? pc.bold(paddedCell) : paddedCell;
  });

  return `${INDENT}│${rendered.join('│')}│`;
}

export function renderTable(
  headers: string[],
  rows: string[][],
  columnWidths?: number[],
): string {
  if (headers.length === 0) {
    return '';
  }

  const widths = inferWidths(headers, rows, columnWidths);
  const output: string[] = [];

  output.push(line('┌', '┬', '┐', widths));
  output.push(renderRow(headers, widths, true));
  output.push(line('├', '┼', '┤', widths));

  for (const row of rows) {
    output.push(renderRow(row, widths));
  }

  output.push(line('└', '┴', '┘', widths));

  return output.join('\n');
}
