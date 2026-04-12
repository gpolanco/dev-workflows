import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileExists } from '../utils/fs.js';

export interface ResolvedContext {
  configRoot: string;
  outputRoot: string;
  globalMode: boolean;
  dwfDir: string;
}

export async function resolveContext(cwd: string): Promise<ResolvedContext | null> {
  const localConfig = join(cwd, '.dwf', 'config.yml');
  if (await fileExists(localConfig)) {
    return {
      configRoot: cwd,
      outputRoot: cwd,
      globalMode: false,
      dwfDir: join(cwd, '.dwf'),
    };
  }

  const home = homedir();
  const globalConfig = join(home, '.dwf', 'config.yml');
  if (await fileExists(globalConfig)) {
    return {
      configRoot: home,
      outputRoot: home,
      globalMode: true,
      dwfDir: join(home, '.dwf'),
    };
  }

  return null;
}
