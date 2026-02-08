# Dev Workflows

CLI tool that compiles developer rules into editor-specific config files (CLAUDE.md, .cursor/rules, GEMINI.md).

## Stack

- Monorepo with pnpm workspaces
- CLI in `packages/cli/` (TypeScript, commander)
- Rule blocks in `content/blocks/` (YAML)
- Tests with node:test

## Architecture

- `content/core/` → tool-agnostic source of truth (workflows, skills, templates)
- `content/blocks/` → precooked rule blocks (YAML)
- `packages/cli/src/bridges/` → per-tool adapters that translate core → native format
- Bridges only translate. They do not add new intent or logic.

## Key commands

```bash
pnpm install          # install deps
pnpm build            # build CLI
pnpm test             # run tests
pnpm dev              # dev mode
```

## Specs (read before implementing)

- `docs/internal/CLI_SPEC.md` → v0.1 specification (COMPLETE)
- `docs/internal/CLI_SPEC_v0.2.md` → v0.2 specification (COMPLETE)
- `docs/internal/CLI_SPEC_v0.2.1.md` → v0.2.1 UX polish specification (ACTIVE — implement this)
- `docs/internal/DOCS_SPEC.md` → Mintlify documentation spec
- `docs/internal/DECISIONS.md` → accepted decisions (source of truth if conflict)
- `docs/internal/` is gitignored — internal specs not published


If a decision is not in the specs, do not implement it. Propose a documentation change first.

## Git workflow (BLOCKING — do this BEFORE writing any code)

1. NEVER commit directly to `main`. Always create a feature branch first.
2. Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`
3. Commits: `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, `chore(scope): ...`
4. Don't create PRs without my approval.
5. One PR per feature. Include: what/why, list of changes, how to test.
6. Clean up branch after merge.

If you are on `main`, stop and create a branch before doing anything else.

## What NOT to do

- Do not add dependencies not listed in `docs/internal/CLI_SPEC.md` without asking.
- Do not create new documentation trees. Update existing docs instead.
- Do not move files or rename directories unless explicitly instructed.

<!-- BEGIN dev-workflows -->
# Project Rules

## Conventions

- Never use `any`. Use `unknown` when the type is truly unknown,
  then narrow with type guards.

- Always declare explicit return types on exported functions.
  Inferred types are fine for internal/private functions.

- Prefer union types over enums.
  Use `as const` objects when you need runtime values.

- Never use non-null assertion (!). Handle null/undefined explicitly
  with optional chaining, nullish coalescing, or type guards.

- Follow the Rules of Hooks: only call hooks at the top level,
  never inside conditions or loops. Custom hooks must start
  with "use".

- Use PascalCase for component names and their files.
  Use camelCase for hook files prefixed with "use"
  (e.g. useAuth.ts).

- Prefer composition over prop drilling. Use children,
  render props, or context for shared behavior rather than
  deeply nested prop chains.

- Avoid inline styles. Use CSS modules, Tailwind classes,
  or styled-components for styling.
<!-- END dev-workflows -->
