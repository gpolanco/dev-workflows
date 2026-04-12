import type { ScopeMetadata } from '../bridges/types.js';

export const SCOPE_REGEX = /^[a-z][a-z0-9]*(?::[a-z][a-z0-9-]*)?$/;

export const BUILTIN_SCOPES = ['architecture', 'conventions', 'security', 'workflow', 'testing'] as const;
export type BuiltinScope = (typeof BUILTIN_SCOPES)[number];

export const VALID_TOOL_IDS = ['claude', 'cursor', 'gemini', 'windsurf', 'copilot'] as const;
export type ValidToolId = (typeof VALID_TOOL_IDS)[number];

export const VALID_TRIGGERS = ['always', 'glob', 'manual'] as const;
export type ValidTrigger = (typeof VALID_TRIGGERS)[number];

export const VALID_CONFIG_VERSIONS = ['0.1', '0.2'] as const;

export function isValidScope(scope: string): boolean {
  return SCOPE_REGEX.test(scope);
}

export function isBuiltinScope(scope: string): scope is BuiltinScope {
  return (BUILTIN_SCOPES as readonly string[]).includes(scope);
}

export function isValidTrigger(value: string): value is ValidTrigger {
  return (VALID_TRIGGERS as readonly string[]).includes(value);
}

export interface ScopeMetadataValidationError {
  field: string;
  message: string;
}

export function validateScopeMetadata(raw: Record<string, unknown>): { metadata: ScopeMetadata | undefined; errors: ScopeMetadataValidationError[] } {
  const errors: ScopeMetadataValidationError[] = [];
  const metadata: ScopeMetadata = {};
  let hasMetadata = false;

  if ('globs' in raw && raw['globs'] !== undefined) {
    if (!Array.isArray(raw['globs']) || !raw['globs'].every((g): g is string => typeof g === 'string')) {
      errors.push({ field: 'globs', message: 'globs must be an array of strings' });
    } else {
      metadata.globs = raw['globs'];
      hasMetadata = true;
    }
  }

  if ('paths' in raw && raw['paths'] !== undefined) {
    if (!Array.isArray(raw['paths']) || !raw['paths'].every((p): p is string => typeof p === 'string')) {
      errors.push({ field: 'paths', message: 'paths must be an array of strings' });
    } else {
      metadata.paths = raw['paths'];
      hasMetadata = true;
    }
  }

  if ('trigger' in raw && raw['trigger'] !== undefined) {
    const triggerVal = String(raw['trigger']);
    if (!isValidTrigger(triggerVal)) {
      errors.push({ field: 'trigger', message: `trigger must be one of: ${VALID_TRIGGERS.join(', ')}. Got "${triggerVal}"` });
    } else {
      metadata.trigger = triggerVal;
      hasMetadata = true;
    }
  }

  return { metadata: hasMetadata ? metadata : undefined, errors };
}
