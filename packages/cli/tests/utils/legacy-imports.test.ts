import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');

async function collectTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectTypeScriptFiles(fullPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('legacy imports are fully removed from src', () => {
  it('does not use chalk or @inquirer/prompts', async () => {
    const tsFiles = await collectTypeScriptFiles(SRC_ROOT);
    const offenders: string[] = [];

    for (const filePath of tsFiles) {
      const content = await readFile(filePath, 'utf-8');
      if (content.includes("'chalk'") || content.includes('"chalk"')) {
        offenders.push(`${filePath}: chalk`);
      }
      if (content.includes('@inquirer/prompts')) {
        offenders.push(`${filePath}: @inquirer/prompts`);
      }
    }

    assert.deepEqual(offenders, []);
  });
});
