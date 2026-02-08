export const SCOPE_REGEX = /^[a-z][a-z0-9]*(?::[a-z][a-z0-9-]*)?$/;

export const BUILTIN_SCOPES = ['architecture', 'conventions', 'security', 'workflow', 'testing'] as const;
export type BuiltinScope = (typeof BUILTIN_SCOPES)[number];

export const VALID_TOOL_IDS = ['claude', 'cursor', 'gemini', 'windsurf', 'copilot'] as const;
export type ValidToolId = (typeof VALID_TOOL_IDS)[number];

export function isValidScope(scope: string): boolean {
  return SCOPE_REGEX.test(scope);
}

export function isBuiltinScope(scope: string): scope is BuiltinScope {
  return (BUILTIN_SCOPES as readonly string[]).includes(scope);
}
