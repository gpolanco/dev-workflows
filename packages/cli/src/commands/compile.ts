import type { Command } from 'commander';

export interface CompileOptions {
  tool?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export function registerCompileCommand(program: Command): void {
  program
    .command('compile')
    .description('Compile .dwf/ rules into editor-specific config files')
    .option('--tool <tool>', 'Compile only a specific bridge (claude, cursor, gemini)')
    .option('--dry-run', 'Show output without writing files')
    .option('--verbose', 'Show detailed output')
    .action((options: CompileOptions) => {
      console.log('devw compile — not yet implemented');
      console.log('options:', options);
    });
}
