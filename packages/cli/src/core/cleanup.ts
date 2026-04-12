import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileExists } from '../utils/fs.js';
import { removeMarkedBlock } from './markers.js';

export interface LegacyFile {
  path: string;
  type: 'marker' | 'full-file';
  bridgeId: string;
}

/**
 * Detect legacy single-file output from v0.5/v0.6 that needs migration.
 *
 * Only .cursor and .windsurf had full-file replacement, so only those are legacy.
 * CLAUDE.md markers need to be removed since Claude is now a DirectoryBridge.
 * GEMINI.md and .github/copilot-instructions.md are NOT legacy (they remain MarkerBridge).
 */
export async function detectLegacyFiles(cwd: string): Promise<LegacyFile[]> {
  const legacyFiles: LegacyFile[] = [];

  // Check for legacy .cursor/rules/devworkflows.mdc (full-file)
  const cursorLegacy = join(cwd, '.cursor', 'rules', 'devworkflows.mdc');
  if (await fileExists(cursorLegacy)) {
    legacyFiles.push({
      path: cursorLegacy,
      type: 'full-file',
      bridgeId: 'cursor',
    });
  }

  // Check for legacy .windsurf/rules/devworkflows.md (full-file)
  const windsurfLegacy = join(cwd, '.windsurf', 'rules', 'devworkflows.md');
  if (await fileExists(windsurfLegacy)) {
    legacyFiles.push({
      path: windsurfLegacy,
      type: 'full-file',
      bridgeId: 'windsurf',
    });
  }

  // Check for CLAUDE.md with dev-workflows markers (marker type)
  const claudeLegacy = join(cwd, 'CLAUDE.md');
  if (await fileExists(claudeLegacy)) {
    const content = await readFile(claudeLegacy, 'utf-8');
    if (content.includes('<!-- BEGIN dev-workflows -->') && content.includes('<!-- END dev-workflows -->')) {
      legacyFiles.push({
        path: claudeLegacy,
        type: 'marker',
        bridgeId: 'claude',
      });
    }
  }

  return legacyFiles;
}

/**
 * Remove legacy files. For full-file types, delete the file.
 * For marker types, remove the marker block preserving user content.
 * Returns list of actions taken (for user messaging).
 *
 * This is idempotent — if files don't exist, skip silently.
 */
export async function migrateLegacyFiles(_cwd: string, legacyFiles: LegacyFile[]): Promise<string[]> {
  const actions: string[] = [];

  for (const legacy of legacyFiles) {
    if (!(await fileExists(legacy.path))) {
      continue;
    }

    if (legacy.type === 'full-file') {
      await unlink(legacy.path);
      actions.push(`Removed legacy ${legacy.path}`);
    } else if (legacy.type === 'marker') {
      const removed = await removeLegacyMarkerBlock(legacy.path);
      if (removed) {
        actions.push(`Removed devw block from ${legacy.path}`);
      }
    }
  }

  return actions;
}

/**
 * Remove the old marker block (BEGIN/END dev-workflows) from a file.
 * If the file becomes empty after removal, delete it.
 * Returns true if changes were made.
 */
export async function removeLegacyMarkerBlock(filePath: string): Promise<boolean> {
  if (!(await fileExists(filePath))) {
    return false;
  }

  const content = await readFile(filePath, 'utf-8');

  if (!content.includes('<!-- BEGIN dev-workflows -->') || !content.includes('<!-- END dev-workflows -->')) {
    return false;
  }

  const cleaned = removeMarkedBlock(content);

  if (cleaned.trim() === '') {
    await unlink(filePath);
  } else {
    await writeFile(filePath, cleaned, 'utf-8');
  }

  return true;
}
