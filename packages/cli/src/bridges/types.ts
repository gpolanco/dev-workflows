export interface Rule {
  id: string;
  scope: string;
  severity: 'error' | 'warning' | 'info';
  content: string;
  tags?: string[];
  enabled: boolean;
  sourceBlock?: string;
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
}

export interface Bridge {
  id: string;
  outputPaths: string[];
  compile(rules: Rule[], config: ProjectConfig): Map<string, string>;
}
