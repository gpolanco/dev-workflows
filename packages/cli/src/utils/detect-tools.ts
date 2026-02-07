import { access } from 'node:fs/promises';
import { join } from 'node:path';

export type ToolId = 'claude' | 'cursor' | 'gemini';

export const SUPPORTED_TOOLS: ToolId[] = ['claude', 'cursor', 'gemini'];

export interface DetectedTool {
  id: ToolId;
  detected: boolean;
}

const TOOL_MARKERS: Record<ToolId, string> = {
  claude: 'CLAUDE.md',
  cursor: '.cursor',
  gemini: 'GEMINI.md',
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectTools(cwd: string): Promise<DetectedTool[]> {
  const results = await Promise.all(
    SUPPORTED_TOOLS.map(async (id) => {
      const marker = TOOL_MARKERS[id];
      if (!marker) return { id, detected: false };
      const detected = await exists(join(cwd, marker));
      return { id, detected };
    }),
  );
  return results;
}
