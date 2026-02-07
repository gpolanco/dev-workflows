import { join } from 'node:path';
import { fileExists } from './fs.js';

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

export async function detectTools(cwd: string): Promise<DetectedTool[]> {
  const results = await Promise.all(
    SUPPORTED_TOOLS.map(async (id) => {
      const marker = TOOL_MARKERS[id];
      if (!marker) return { id, detected: false };
      const detected = await fileExists(join(cwd, marker));
      return { id, detected };
    }),
  );
  return results;
}
