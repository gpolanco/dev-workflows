import type { Command } from 'commander';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Validate .dwf/ configuration and check for issues')
    .action(() => {
      console.log('devw doctor — not yet implemented');
    });
}
