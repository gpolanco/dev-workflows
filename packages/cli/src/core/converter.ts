import { parse as parseYaml } from 'yaml';
import { isValidScope } from './schema.js';

export interface ConvertedRule {
  id: string;
  scope: string;
  severity: 'error';
  content: string;
  tags: string[];
  source: string;
}

export interface ConvertResult {
  name: string;
  description: string;
  version: string;
  scope: string;
  tags: string[];
  rules: ConvertedRule[];
}

interface Frontmatter {
  name: string;
  description: string;
  version: string;
  scope: string;
  tags: string[];
}

function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
  const fmRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = fmRegex.exec(markdown);

  if (!match?.[1]) {
    throw new Error('Invalid rule file: missing YAML frontmatter');
  }

  const raw: unknown = parseYaml(match[1]);
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid rule file: frontmatter is not an object');
  }

  const fm = raw as Record<string, unknown>;

  const name = typeof fm['name'] === 'string' ? fm['name'] : '';
  const description = typeof fm['description'] === 'string' ? fm['description'] : '';
  const version = typeof fm['version'] === 'string' ? fm['version'] : '0.1.0';
  const scope = typeof fm['scope'] === 'string' ? fm['scope'] : 'conventions';
  const tags = Array.isArray(fm['tags'])
    ? fm['tags'].filter((t): t is string => typeof t === 'string')
    : [];

  if (!name) {
    throw new Error('Invalid rule file: missing "name" in frontmatter');
  }
  if (!description) {
    throw new Error('Invalid rule file: missing "description" in frontmatter');
  }
  if (!isValidScope(scope)) {
    throw new Error(`Invalid rule file: invalid scope "${scope}"`);
  }

  return {
    frontmatter: { name, description, version, scope, tags },
    body: match[2] ?? '',
  };
}

function toKebabCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface ParsedBullet {
  heading: string | null;
  content: string;
  index: number;
}

function parseBullets(body: string): ParsedBullet[] {
  const lines = body.split('\n');
  const bullets: ParsedBullet[] = [];
  let currentHeading: string | null = null;
  let headingIndex = 0;
  let currentBullet: string | null = null;

  function flushBullet(): void {
    if (currentBullet !== null) {
      bullets.push({
        heading: currentHeading,
        content: currentBullet.trimEnd(),
        index: headingIndex++,
      });
      currentBullet = null;
    }
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushBullet();
      currentHeading = toKebabCase(line.slice(3).trim());
      headingIndex = 0;
      continue;
    }

    if (line.startsWith('- ')) {
      flushBullet();
      currentBullet = line.slice(2);
      continue;
    }

    // Indented continuation (2+ spaces) of a bullet
    if (currentBullet !== null && line.length > 0 && /^\s{2,}/.test(line)) {
      currentBullet += '\n' + line.trimStart();
      continue;
    }

    // Empty line — might be between bullets, keep accumulating
    if (currentBullet !== null && line.trim() === '') {
      continue;
    }

    // Non-bullet, non-heading content — flush if we had a bullet
    if (currentBullet !== null && line.trim() !== '') {
      flushBullet();
    }
  }

  flushBullet();
  return bullets;
}

export function convert(markdown: string, category: string, name: string): ConvertResult {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const bullets = parseBullets(body);
  const source = `${category}/${name}`;

  const rules: ConvertedRule[] = bullets.map((bullet) => {
    const headingPart = bullet.heading ? `-${bullet.heading}` : '';
    const id = `pulled-${category}-${name}${headingPart}-${String(bullet.index)}`;

    return {
      id,
      scope: frontmatter.scope,
      severity: 'error' as const,
      content: bullet.content,
      tags: [...frontmatter.tags],
      source,
    };
  });

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version,
    scope: frontmatter.scope,
    tags: frontmatter.tags,
    rules,
  };
}
