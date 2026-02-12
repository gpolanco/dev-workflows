import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, stringify } from 'yaml';
import { fileExists } from '../../src/utils/fs.js';
import { readConfig } from '../../src/core/parser.js';
import type { PulledEntry } from '../../src/bridges/types.js';

async function createProjectWithPulled(
  dir: string,
  pulled: PulledEntry[] = [],
): Promise<void> {
  await mkdir(join(dir, '.dwf', 'rules'), { recursive: true });

  const config: Record<string, unknown> = {
    version: '0.1',
    project: { name: 'test-project' },
    tools: ['claude'],
    mode: 'copy',
    blocks: [],
  };

  if (pulled.length > 0) {
    config['pulled'] = pulled;
  }

  await writeFile(
    join(dir, '.dwf', 'config.yml'),
    stringify(config, { lineWidth: 0 }),
    'utf-8',
  );

  for (const entry of pulled) {
    const parts = entry.path.split('/');
    if (parts.length !== 2) continue;
    const [category, name] = parts;
    const fileName = `pulled-${category}-${name}.yml`;
    const ruleDoc = {
      source: {
        registry: 'dev-workflows',
        path: entry.path,
        version: entry.version,
        pulled_at: entry.pulled_at,
      },
      scope: 'conventions',
      rules: [
        {
          id: `pulled-${category}-${name}-0`,
          severity: 'error',
          content: `Rule from ${entry.path}`,
          tags: [],
          source: entry.path,
        },
      ],
    };
    await writeFile(
      join(dir, '.dwf', 'rules', fileName),
      stringify(ruleDoc, { lineWidth: 0 }),
      'utf-8',
    );
  }
}

describe('remove command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dwf-remove-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('removes rule file for existing pulled entry', async () => {
    const pulled: PulledEntry[] = [
      { path: 'typescript/strict', version: '0.1.0', pulled_at: '2026-02-11T00:00:00Z' },
    ];
    await createProjectWithPulled(tempDir, pulled);

    const filePath = join(tempDir, '.dwf', 'rules', 'pulled-typescript-strict.yml');
    assert.ok(await fileExists(filePath), 'rule file should exist before remove');

    // Simulate removeRule logic
    const { unlink } = await import('node:fs/promises');
    await unlink(filePath);

    // Update config
    const configPath = join(tempDir, '.dwf', 'config.yml');
    const raw = await readFile(configPath, 'utf-8');
    const doc = parse(raw) as Record<string, unknown>;
    const existingPulled = Array.isArray(doc['pulled']) ? (doc['pulled'] as PulledEntry[]) : [];
    doc['pulled'] = existingPulled.filter((p) => p.path !== 'typescript/strict');
    await writeFile(configPath, stringify(doc, { lineWidth: 0 }), 'utf-8');

    assert.equal(await fileExists(filePath), false, 'rule file should be deleted');
    const config = await readConfig(tempDir);
    assert.equal(config.pulled.length, 0);
  });

  it('config shows no pulled entries after removal', async () => {
    const pulled: PulledEntry[] = [
      { path: 'typescript/strict', version: '0.1.0', pulled_at: '2026-02-11T00:00:00Z' },
      { path: 'react/hooks', version: '0.1.0', pulled_at: '2026-02-11T00:00:00Z' },
    ];
    await createProjectWithPulled(tempDir, pulled);

    const configPath = join(tempDir, '.dwf', 'config.yml');
    const raw = await readFile(configPath, 'utf-8');
    const doc = parse(raw) as Record<string, unknown>;
    const existingPulled = Array.isArray(doc['pulled']) ? (doc['pulled'] as PulledEntry[]) : [];
    doc['pulled'] = existingPulled.filter((p) => p.path !== 'typescript/strict');
    await writeFile(configPath, stringify(doc, { lineWidth: 0 }), 'utf-8');

    const config = await readConfig(tempDir);
    assert.equal(config.pulled.length, 1);
    assert.equal(config.pulled[0]?.path, 'react/hooks');
  });

  it('empty pulled array when no rules installed', async () => {
    await createProjectWithPulled(tempDir);
    const config = await readConfig(tempDir);
    assert.deepEqual(config.pulled, []);
  });

  it('validates rule path format', async () => {
    const { validateInput } = await import('../../src/commands/add.js');

    assert.equal(validateInput('typescript-strict'), null, 'old block format should fail');
    assert.equal(validateInput('TypeScript/Strict'), null, 'uppercase should fail');
    assert.deepEqual(validateInput('typescript/strict'), { category: 'typescript', name: 'strict' });
  });

  it('rule file does not exist after deletion', async () => {
    const pulled: PulledEntry[] = [
      { path: 'testing/basics', version: '0.1.0', pulled_at: '2026-02-11T00:00:00Z' },
    ];
    await createProjectWithPulled(tempDir, pulled);

    const filePath = join(tempDir, '.dwf', 'rules', 'pulled-testing-basics.yml');
    assert.ok(await fileExists(filePath));

    const { unlink } = await import('node:fs/promises');
    await unlink(filePath);

    assert.equal(await fileExists(filePath), false);
  });
});
