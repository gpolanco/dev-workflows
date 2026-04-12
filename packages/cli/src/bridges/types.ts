export interface ScopeMetadata {
  globs?: string[];
  paths?: string[];
  trigger?: 'always' | 'glob' | 'manual';
}

export interface Rule {
  id: string;
  scope: string;
  severity: 'error' | 'warning' | 'info';
  content: string;
  tags?: string[];
  enabled: boolean;
  sourceBlock?: string;
  source?: string;
  metadata?: ScopeMetadata;
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
  global: boolean;
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

interface BaseBridge {
  id: string;
  compile(rules: Rule[], config: ProjectConfig): Map<string, string>;
}

export interface DirectoryBridge extends BaseBridge {
  kind: 'directory';
  outputDir: string;
  filePrefix: string;
  fileExtension: string;
}

export interface MarkerBridge extends BaseBridge {
  kind: 'marker';
  outputPaths: string[];
  usesMarkers: true;
}

export type Bridge = DirectoryBridge | MarkerBridge;

export function isDirectoryBridge(bridge: Bridge): bridge is DirectoryBridge {
  return bridge.kind === 'directory';
}

export function isMarkerBridge(bridge: Bridge): bridge is MarkerBridge {
  return bridge.kind === 'marker';
}

/** Get the known output paths for a bridge (for MarkerBridge returns outputPaths, for DirectoryBridge returns empty since paths are dynamic). */
export function getBridgeOutputPaths(bridge: Bridge): string[] {
  if (isMarkerBridge(bridge)) {
    return bridge.outputPaths;
  }
  return [];
}
