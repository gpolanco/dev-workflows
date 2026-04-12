const BANNER_LINES = [
  ' ____             __      __           __      __',
  '|  _ \\  ___ _   _\\ \\    / /__  _ __| | __ / _| ___  __ _',
  "| | | |/ _ \\ | | |\\ \\  / / _ \\| '__| |/ /| |_ / _ \\/ _` |",
  '| |_| |  __/ |_| | \\ \\/ / (_) | |  |   < |  _|  __/ (_| |',
  '|____/ \\___|\\__,_|  \\__/ \\___/|_|  |_|\\_\\|_|  \\___|\\__,_|',
] as const;

const GRADIENT_START = 45;
const GRADIENT_END = 201;

function colorizeLine(line: string, color: number): string {
  return `\u001b[38;5;${String(color)}m${line}\u001b[0m`;
}

function gradientColor(index: number, total: number): number {
  if (total <= 1) {
    return GRADIENT_START;
  }

  const ratio = index / (total - 1);
  return Math.round(GRADIENT_START + (GRADIENT_END - GRADIENT_START) * ratio);
}

export function renderBanner(): string {
  if (!process.stdout.isTTY) {
    return '';
  }

  return BANNER_LINES.map((line, index) => {
    const color = gradientColor(index, BANNER_LINES.length);
    return colorizeLine(line, color);
  }).join('\n');
}
