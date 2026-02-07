import type { Command } from 'commander';

export interface InitOptions {
  tools?: string;
  mode?: 'copy' | 'link';
  yes?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize .dwf/ in the current project')
    .option('--tools <tools>', 'Comma-separated list of tools (claude,cursor,gemini)')
    .option('--mode <mode>', 'Output mode: copy or link')
    .option('-y, --yes', 'Accept all defaults')
    .action((options: InitOptions) => {
      console.log('devw init — not yet implemented');
      console.log('options:', options);
    });
}
