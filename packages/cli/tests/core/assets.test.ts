import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  isAssetType,
  parseAssetFrontmatter,
  readAssets,
  deployCommands,
  deployTemplates,
  deployHooks,
  deployAssets,
  removeAsset,
} from '../../src/core/assets.js';
import type { ProjectConfig } from '../../src/bridges/types.js';
import { fileExists } from '../../src/utils/fs.js';

const CONFIG: ProjectConfig = {
  version: '0.1',
  project: { name: 'test' },
  tools: ['claude'],
  mode: 'copy',
  blocks: [],
  pulled: [],
  assets: [],
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'assets-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('isAssetType', () => {
  it('returns true for command', () => {
    assert.equal(isAssetType('command'), true);
  });

  it('returns true for template', () => {
    assert.equal(isAssetType('template'), true);
  });

  it('returns true for hook', () => {
    assert.equal(isAssetType('hook'), true);
  });

  it('returns false for rule', () => {
    assert.equal(isAssetType('rule'), false);
  });

  it('returns false for arbitrary string', () => {
    assert.equal(isAssetType('foobar'), false);
  });

  it('returns false for preset', () => {
    assert.equal(isAssetType('preset'), false);
  });
});

describe('parseAssetFrontmatter', () => {
  it('parses frontmatter from markdown', () => {
    const content = `---
name: spec
description: Generate a spec
version: "0.2.0"
tool: claude
---
Body content here`;

    const { frontmatter, body } = parseAssetFrontmatter(content);
    assert.equal(frontmatter.name, 'spec');
    assert.equal(frontmatter.description, 'Generate a spec');
    assert.equal(frontmatter.version, '0.2.0');
    assert.equal(frontmatter.tool, 'claude');
    assert.ok(body.includes('Body content here'));
  });

  it('returns defaults when no frontmatter', () => {
    const content = 'Just body content';
    const { frontmatter, body } = parseAssetFrontmatter(content);
    assert.equal(frontmatter.name, '');
    assert.equal(frontmatter.version, '0.1.0');
    assert.equal(body, 'Just body content');
  });

  it('handles output_path', () => {
    const content = `---
name: feature-spec
description: Feature spec template
output_path: docs/specs
---
Template body`;

    const { frontmatter } = parseAssetFrontmatter(content);
    assert.equal(frontmatter.output_path, 'docs/specs');
  });
});

describe('readAssets', () => {
  it('returns empty array when no assets directory', async () => {
    const assets = await readAssets(tmpDir);
    assert.deepEqual(assets, []);
  });

  it('reads assets from all type directories', async () => {
    const commandsDir = join(tmpDir, '.dwf', 'assets', 'commands');
    const hooksDir = join(tmpDir, '.dwf', 'assets', 'hooks');
    await mkdir(commandsDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });

    await writeFile(join(commandsDir, 'spec.md'), '---\nname: spec\n---\nBody');
    await writeFile(join(hooksDir, 'auto-format.json'), '{"name":"auto-format"}');

    const assets = await readAssets(tmpDir);
    assert.equal(assets.length, 2);

    const command = assets.find((a) => a.type === 'command');
    assert.ok(command);
    assert.equal(command.name, 'spec');

    const hook = assets.find((a) => a.type === 'hook');
    assert.ok(hook);
    assert.equal(hook.name, 'auto-format');
  });
});

describe('deployCommands', () => {
  it('deploys commands stripping frontmatter', async () => {
    const commandsDir = join(tmpDir, '.dwf', 'assets', 'commands');
    await mkdir(commandsDir, { recursive: true });

    await writeFile(
      join(commandsDir, 'spec.md'),
      '---\nname: spec\ndescription: Generate a spec\nversion: "0.1.0"\ntool: claude\n---\nYou are a spec generator.\nDo great things.',
    );

    const result = await deployCommands(tmpDir, CONFIG);
    assert.equal(result.deployed.length, 1);
    assert.equal(result.deployed[0], '.claude/commands/spec.md');

    const output = await readFile(join(tmpDir, '.claude', 'commands', 'spec.md'), 'utf-8');
    assert.ok(!output.includes('---'));
    assert.ok(output.includes('You are a spec generator.'));
  });

  it('returns empty when no commands dir', async () => {
    const result = await deployCommands(tmpDir, CONFIG);
    assert.deepEqual(result.deployed, []);
  });
});

describe('deployTemplates', () => {
  it('deploys templates to output_path', async () => {
    const templatesDir = join(tmpDir, '.dwf', 'assets', 'templates');
    await mkdir(templatesDir, { recursive: true });

    await writeFile(
      join(templatesDir, 'feature-spec.md'),
      '---\nname: feature-spec\ndescription: Template\noutput_path: docs/specs\n---\n# Feature Spec\n\n## Summary',
    );

    const result = await deployTemplates(tmpDir, CONFIG);
    assert.equal(result.deployed.length, 1);
    assert.equal(result.deployed[0], 'docs/specs/feature-spec.md');

    const output = await readFile(join(tmpDir, 'docs', 'specs', 'feature-spec.md'), 'utf-8');
    assert.ok(output.includes('# Feature Spec'));
    assert.ok(!output.includes('---'));
  });
});

describe('deployHooks', () => {
  it('merges hook settings into settings.local.json', async () => {
    const hooksDir = join(tmpDir, '.dwf', 'assets', 'hooks');
    await mkdir(hooksDir, { recursive: true });

    const hookContent = JSON.stringify({
      name: 'auto-format',
      version: '0.1.0',
      settings: {
        hooks: {
          PostToolUse: [{ matcher: 'Write|Edit', command: 'pnpm format || true' }],
        },
      },
    });
    await writeFile(join(hooksDir, 'auto-format.json'), hookContent);

    const result = await deployHooks(tmpDir, CONFIG);
    assert.equal(result.deployed.length, 1);

    const settings = JSON.parse(
      await readFile(join(tmpDir, '.claude', 'settings.local.json'), 'utf-8'),
    );
    assert.ok(Array.isArray(settings.hooks.PostToolUse));
    assert.equal(settings.hooks.PostToolUse[0].matcher, 'Write|Edit');
  });
});

describe('deployAssets', () => {
  it('deploys all asset types', async () => {
    const commandsDir = join(tmpDir, '.dwf', 'assets', 'commands');
    await mkdir(commandsDir, { recursive: true });
    await writeFile(join(commandsDir, 'spec.md'), '---\nname: spec\n---\nBody');

    const result = await deployAssets(tmpDir, CONFIG);
    assert.ok(result.deployed.length > 0);
  });
});

describe('removeAsset', () => {
  it('removes an existing asset file', async () => {
    const commandsDir = join(tmpDir, '.dwf', 'assets', 'commands');
    await mkdir(commandsDir, { recursive: true });
    await writeFile(join(commandsDir, 'spec.md'), 'content');

    const removed = await removeAsset(tmpDir, 'command', 'spec');
    assert.equal(removed, true);
    assert.equal(await fileExists(join(commandsDir, 'spec.md')), false);
  });

  it('returns false for non-existent asset', async () => {
    const removed = await removeAsset(tmpDir, 'command', 'nonexistent');
    assert.equal(removed, false);
  });

  it('uses .json extension for hooks', async () => {
    const hooksDir = join(tmpDir, '.dwf', 'assets', 'hooks');
    await mkdir(hooksDir, { recursive: true });
    await writeFile(join(hooksDir, 'auto-format.json'), '{}');

    const removed = await removeAsset(tmpDir, 'hook', 'auto-format');
    assert.equal(removed, true);
  });
});
