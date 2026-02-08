import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerCompileCommand } from './commands/compile.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerAddCommand } from './commands/add.js';
import { registerRemoveCommand } from './commands/remove.js';
import { registerListCommand } from './commands/list.js';
import { registerExplainCommand } from './commands/explain.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('devw')
  .description('Compile developer rules into editor-specific config files')
  .version(pkg.version);

registerInitCommand(program);
registerCompileCommand(program);
registerDoctorCommand(program);
registerAddCommand(program);
registerRemoveCommand(program);
registerListCommand(program);
registerExplainCommand(program);

program.parse();

export { program };
