export interface Rule {
  id: string;
  scope: string;
  severity: 'error' | 'warning' | 'info';
  content: string;
  tags?: string[];
  enabled: boolean;
  sourceBlock?: string;
  source?: string;
}

export interface PulledEntry {
  path: string;
  version: string;
  pulled_at: string;
}

export interface ProjectConfig {
  version: string;
  project: {
    name: string;
    description?: string;
  };
  tools: string[];
  mode: 'copy' | 'link';
  blocks: string[];
  pulled: PulledEntry[];
  assets: AssetEntry[];
}

export const ASSET_TYPE = {
  Command: 'command',
  Template: 'template',
  Hook: 'hook',
} as const;

export type AssetType = typeof ASSET_TYPE[keyof typeof ASSET_TYPE];

export interface AssetEntry {
  type: AssetType;
  name: string;
  version: string;
  installed_at: string;
}

export interface Bridge {
  id: string;
  outputPaths: string[];
  usesMarkers: boolean;
  compile(rules: Rule[], config: ProjectConfig): Map<string, string>;
}
