export interface RegistryRule {
  path: string;
  name: string;
  description: string;
  version: string;
  scope: string;
  tags: string[];
  size_bytes: number;
}

export interface RegistryAssets {
  commands: string[];
  templates: string[];
  hooks: string[];
  presets: string[];
}

export interface Registry {
  version: number;
  generated_at: string;
  rules: RegistryRule[];
  assets: RegistryAssets;
}

export function filterRegistryByTag(registry: Registry, tag: string): RegistryRule[] {
  const normalizedTag = tag.trim().toLowerCase();
  if (normalizedTag.length === 0) {
    return [...registry.rules];
  }

  return registry.rules.filter((rule) =>
    rule.tags.some((ruleTag) => ruleTag.toLowerCase() === normalizedTag),
  );
}

export function searchRegistry(registry: Registry, query: string): RegistryRule[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  if (terms.length === 0) {
    return [...registry.rules];
  }

  return registry.rules.filter((rule) => {
    const searchableFields = [
      rule.name,
      rule.description,
      rule.path,
      ...rule.tags,
    ].map((field) => field.toLowerCase());

    return terms.every((term) =>
      searchableFields.some((fieldValue) => fieldValue.includes(term)),
    );
  });
}
