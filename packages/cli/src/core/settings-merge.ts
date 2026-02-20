import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileExists } from '../utils/fs.js';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function deepMerge(target: Record<string, JsonValue>, source: Record<string, JsonValue>): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]!;
    const targetVal = result[key];

    if (Array.isArray(sourceVal) && Array.isArray(targetVal)) {
      result[key] = [...targetVal, ...sourceVal];
    } else if (
      sourceVal !== null && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
      targetVal !== null && typeof targetVal === 'object' && !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, JsonValue>,
        sourceVal as Record<string, JsonValue>,
      );
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

export async function mergeSettingsFile(
  cwd: string,
  hookSettings: Record<string, JsonValue>,
): Promise<void> {
  const settingsPath = join(cwd, '.claude', 'settings.local.json');

  let existing: Record<string, JsonValue> = {};
  if (await fileExists(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        existing = parsed as Record<string, JsonValue>;
      }
    } catch {
      // Corrupted file — start fresh
    }
  }

  const merged = deepMerge(existing, hookSettings);
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}
