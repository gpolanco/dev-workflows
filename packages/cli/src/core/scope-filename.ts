import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const COLON_SEPARATOR = '-';

/**
 * Convert a scope name to a filename using the given prefix and extension.
 *
 * Colons in the scope are replaced with hyphens.
 * Example: scopeToFilename('team:payments', 'dwf-', '.md') => 'dwf-team-payments.md'
 */
export function scopeToFilename(scope: string, prefix: string, extension: string): string {
  const sanitized = scope.replaceAll(':', COLON_SEPARATOR);
  return `${prefix}${sanitized}${extension}`;
}

/**
 * Glob for files matching {prefix}*{extension} in a directory,
 * delete any that are NOT in the currentFiles set.
 * Returns the list of deleted file paths (relative to dir).
 *
 * Only touches files that start with the given prefix.
 * Ignores files that don't match the prefix pattern.
 * If the directory does not exist, returns an empty array without error.
 */
export async function cleanStaleFiles(
  dir: string,
  prefix: string,
  extension: string,
  currentFiles: Set<string>,
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const deleted: string[] = [];

  for (const entry of entries) {
    if (!entry.startsWith(prefix) || !entry.endsWith(extension)) {
      continue;
    }

    if (!currentFiles.has(entry)) {
      await unlink(join(dir, entry));
      deleted.push(entry);
    }
  }

  return deleted;
}
