import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';
import { parse } from 'yaml';
import { readConfig, readRules } from '../core/parser.js';
import { computeRulesHash, readStoredHash } from '../core/hash.js';
import { claudeBridge } from '../bridges/claude.js';
import { cursorBridge } from '../bridges/cursor.js';
import { geminiBridge } from '../bridges/gemini.js';
import { windsurfBridge } from '../bridges/windsurf.js';
import { copilotBridge } from '../bridges/copilot.js';
import type { Bridge, ProjectConfig, PulledEntry, AssetEntry, Rule } from '../bridges/types.js';
import { fileExists } from '../utils/fs.js';
import { isValidScope } from '../core/schema.js';
import * as ui from '../utils/ui.js';

const BRIDGES: Bridge[] = [claudeBridge, cursorBridge, geminiBridge, windsurfBridge, copilotBridge];
const BRIDGE_IDS = new Set(BRIDGES.map((b) => b.id));

export interface CheckResult {
  passed: boolean;
  message: string;
  skipped?: boolean;
}

export async function checkConfigExists(cwd: string): Promise<CheckResult> {
  const exists = await fileExists(join(cwd, '.dwf', 'config.yml'));
  return exists
    ? { passed: true, message: '.dwf/config.yml exists' }
    : { passed: false, message: '.dwf/config.yml not found — run "devw init"' };
}

export async function checkConfigValid(cwd: string): Promise<CheckResult> {
  try {
    await readConfig(cwd);
    return { passed: true, message: 'config.yml is valid' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { passed: false, message: `config.yml is invalid: ${msg}` };
  }
}

export async function checkRulesValid(cwd: string): Promise<CheckResult> {
  const rulesDir = join(cwd, '.dwf', 'rules');
  let entries: string[];
  try {
    entries = await readdir(rulesDir);
  } catch {
    return { passed: true, message: 'No rules directory found (0 rules loaded)' };
  }

  const ymlFiles = entries.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (ymlFiles.length === 0) {
    return { passed: true, message: 'Rule files are valid YAML (0 rules loaded)' };
  }

  const invalidFiles: string[] = [];
  let totalRules = 0;

  for (const file of ymlFiles) {
    try {
      const raw = await readFile(join(rulesDir, file), 'utf-8');
      const parsed: unknown = parse(raw);
      if (parsed && typeof parsed === 'object') {
        const doc = parsed as Record<string, unknown>;
        if (Array.isArray(doc['rules'])) {
          totalRules += doc['rules'].length;
        }
      }
    } catch {
      invalidFiles.push(file);
    }
  }

  if (invalidFiles.length > 0) {
    return {
      passed: false,
      message: `Invalid YAML in: ${invalidFiles.join(', ')}`,
    };
  }

  return {
    passed: true,
    message: `Rule files are valid YAML (${String(totalRules)} rules loaded)`,
  };
}

export function checkDuplicateIds(rules: Rule[]): CheckResult {
  const scopesById = new Map<string, string[]>();

  for (const rule of rules) {
    const scopes = scopesById.get(rule.id);
    if (scopes) {
      scopes.push(rule.scope);
    } else {
      scopesById.set(rule.id, [rule.scope]);
    }
  }

  const duplicates: string[] = [];
  for (const [id, scopes] of scopesById) {
    if (scopes.length > 1) {
      duplicates.push(`${id} (${scopes.join(', ')})`);
    }
  }

  if (duplicates.length > 0) {
    return {
      passed: false,
      message: `Duplicate rule IDs found: ${duplicates.join(', ')}`,
    };
  }

  return { passed: true, message: 'No duplicate rule IDs' };
}

export function checkScopeFormat(rules: Rule[]): CheckResult {
  const invalidScopes: string[] = [];

  for (const rule of rules) {
    if (!isValidScope(rule.scope)) {
      invalidScopes.push(rule.scope);
    }
  }

  const unique = [...new Set(invalidScopes)];

  if (unique.length > 0) {
    return {
      passed: false,
      message: `Invalid scope format: ${unique.join(', ')}`,
    };
  }

  return { passed: true, message: 'All scopes have valid format' };
}

export function checkBridgesAvailable(config: ProjectConfig): CheckResult {
  const missing = config.tools.filter((t) => !BRIDGE_IDS.has(t));

  if (missing.length > 0) {
    return {
      passed: false,
      message: `No bridge available for: ${missing.join(', ')}`,
    };
  }

  return { passed: true, message: 'All configured tools have bridges' };
}

export async function checkSymlinks(cwd: string, config: ProjectConfig): Promise<CheckResult> {
  if (config.mode !== 'link') {
    return { passed: true, message: 'Symlink check skipped (mode: copy)', skipped: true };
  }

  const brokenLinks: string[] = [];

  for (const bridge of BRIDGES) {
    if (!config.tools.includes(bridge.id)) continue;

    for (const outputPath of bridge.outputPaths) {
      const absolutePath = join(cwd, outputPath);
      try {
        const stat = await lstat(absolutePath);
        if (stat.isSymbolicLink()) {
          const targetExists = await fileExists(absolutePath);
          if (!targetExists) {
            brokenLinks.push(outputPath);
          }
        }
      } catch {
        // File doesn't exist at all — not necessarily an error for this check
      }
    }
  }

  if (brokenLinks.length > 0) {
    return {
      passed: false,
      message: `Broken symlinks: ${brokenLinks.join(', ')}`,
    };
  }

  return { passed: true, message: 'Symlinks are valid' };
}

export async function checkPulledFilesExist(cwd: string, pulled: PulledEntry[]): Promise<CheckResult> {
  if (pulled.length === 0) {
    return { passed: true, message: 'Pulled files check skipped (no pulled rules)', skipped: true };
  }

  const missing: string[] = [];

  for (const entry of pulled) {
    const slug = entry.path.replace(/\//g, '-');
    const fileName = `pulled-${slug}.yml`;
    const filePath = join(cwd, '.dwf', 'rules', fileName);
    if (!(await fileExists(filePath))) {
      missing.push(fileName);
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      message: `Missing pulled rule files: ${missing.join(', ')}`,
    };
  }

  return { passed: true, message: `Pulled rule files exist (${String(pulled.length)} entries)` };
}

export async function checkAssetFilesExist(cwd: string, assets: AssetEntry[]): Promise<CheckResult> {
  if (assets.length === 0) {
    return { passed: true, message: 'Asset files check skipped (no assets installed)', skipped: true };
  }

  const missing: string[] = [];

  for (const asset of assets) {
    const ext = asset.type === 'hook' ? 'json' : 'md';
    const fileName = `${asset.name}.${ext}`;
    const filePath = join(cwd, '.dwf', 'assets', `${asset.type}s`, fileName);
    if (!(await fileExists(filePath))) {
      missing.push(`${asset.type}/${asset.name}`);
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      message: `Missing asset files: ${missing.join(', ')}`,
    };
  }

  return { passed: true, message: `Asset files exist (${String(assets.length)} entries)` };
}

export async function checkHashSync(cwd: string, rules: Rule[]): Promise<CheckResult> {
  const storedHash = await readStoredHash(cwd);
  if (storedHash === null) {
    return {
      passed: true,
      message: 'Hash check skipped (no compiled files found)',
      skipped: true,
    };
  }

  const currentHash = computeRulesHash(rules);
  if (storedHash === currentHash) {
    return { passed: true, message: 'Compiled files are in sync' };
  }

  return {
    passed: false,
    message: 'Compiled files out of sync — run "devw compile"',
  };
}

async function runDoctor(): Promise<void> {
  const cwd = process.cwd();
  const startTime = performance.now();
  const results: CheckResult[] = [];
  let hasFailed = false;

  // Check 1: .dwf/config.yml exists
  const configExistsResult = await checkConfigExists(cwd);
  results.push(configExistsResult);

  if (!configExistsResult.passed) {
    for (const r of results) {
      ui.check(r.passed, r.message, r.skipped);
      if (!r.passed) hasFailed = true;
    }
    printSummary(results, startTime);
    process.exitCode = 1;
    return;
  }

  // Check 2: config.yml is valid
  const configValidResult = await checkConfigValid(cwd);
  results.push(configValidResult);

  let config: ProjectConfig | null = null;
  if (configValidResult.passed) {
    config = await readConfig(cwd);
  }

  // Check 3: Rule files are valid YAML
  const rulesValidResult = await checkRulesValid(cwd);
  results.push(rulesValidResult);

  if (!configValidResult.passed) {
    for (const r of results) {
      ui.check(r.passed, r.message, r.skipped);
      if (!r.passed) hasFailed = true;
    }
    printSummary(results, startTime);
    process.exitCode = 1;
    return;
  }

  // Load rules for remaining checks
  let rules: Rule[] = [];
  try {
    rules = await readRules(cwd);
  } catch {
    // readRules may fail if rules dir is missing; that's ok
  }

  // Check 4: No duplicate rule IDs
  const dupResult = checkDuplicateIds(rules);
  results.push(dupResult);

  // Check 5: Scope format valid
  const scopeResult = checkScopeFormat(rules);
  results.push(scopeResult);

  // Check 6: Tools have bridges
  // config is guaranteed non-null here since configValidResult.passed
  const bridgeResult = checkBridgesAvailable(config!);
  results.push(bridgeResult);

  // Check 7: Symlinks valid (conditional on mode)
  const symlinkResult = await checkSymlinks(cwd, config!);
  results.push(symlinkResult);

  // Check 8: Pulled files exist
  const pulledResult = await checkPulledFilesExist(cwd, config!.pulled);
  results.push(pulledResult);

  // Check 9: Asset files exist
  const assetResult = await checkAssetFilesExist(cwd, config!.assets);
  results.push(assetResult);

  // Check 10: Hash sync (conditional on compiled files existing)
  const hashResult = await checkHashSync(cwd, rules);
  results.push(hashResult);

  // Output
  for (const r of results) {
    ui.check(r.passed, r.message, r.skipped);
    if (!r.passed) hasFailed = true;
  }

  printSummary(results, startTime);

  if (hasFailed) {
    process.exitCode = 1;
  }
}

function printSummary(results: CheckResult[], startTime: number): void {
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;
  const skipped = results.filter((r) => r.skipped).length;
  const elapsed = performance.now() - startTime;

  ui.newline();
  ui.summary({ passed, failed, skipped });
  ui.info(ui.timing(elapsed));
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Validate .dwf/ configuration and check for issues')
    .action(() => runDoctor());
}
