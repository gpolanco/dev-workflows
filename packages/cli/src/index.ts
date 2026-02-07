import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerCompileCommand } from './commands/compile.js';
import { registerDoctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('devw')
  .description('Compile developer rules into editor-specific config files')
  .version('0.1.0');

registerInitCommand(program);
registerCompileCommand(program);
registerDoctorCommand(program);

program.parse();

export { program };
