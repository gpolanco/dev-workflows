import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPulledFilesExist } from '../../src/commands/doctor.js';
import type { PulledEntry } from '../../src/bridges/types.js';

describe('doctor edge cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'dwf-doctor-edge-'));
    await mkdir(join(tempDir, '.dwf', 'rules'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('checkPulledFilesExist', () => {
    it('reports only missing files when some exist and some do not', async () => {
      // Create one pulled file but not the other
      await writeFile(join(tempDir, '.dwf', 'rules', 'pulled-typescript-strict.yml'), 'scope: conventions\nrules: []\n', 'utf-8');

      const pulled: PulledEntry[] = [
        { path: 'typescript/strict', version: '0.1.0', pulled_at: '2026-01-01T00:00:00Z' },
        { path: 'javascript/react', version: '0.1.0', pulled_at: '2026-01-01T00:00:00Z' },
      ];

      const result = await checkPulledFilesExist(tempDir, pulled);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('pulled-javascript-react.yml'));
      assert.ok(!result.message.includes('pulled-typescript-strict.yml'));
    });

    it('converts slashes in path to hyphens for filename check', async () => {
      // Path "typescript/strict" → filename "pulled-typescript-strict.yml"
      await writeFile(join(tempDir, '.dwf', 'rules', 'pulled-typescript-strict.yml'), 'scope: conventions\nrules: []\n', 'utf-8');

      const pulled: PulledEntry[] = [
        { path: 'typescript/strict', version: '0.1.0', pulled_at: '2026-01-01T00:00:00Z' },
      ];

      const result = await checkPulledFilesExist(tempDir, pulled);
      assert.equal(result.passed, true);
    });

    it('returns skipped: true when pulled array is empty', async () => {
      const result = await checkPulledFilesExist(tempDir, []);
      assert.equal(result.passed, true);
      assert.equal(result.skipped, true);
    });
  });
});
