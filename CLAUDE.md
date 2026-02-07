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

- `docs/CLI_SPEC.md` → full CLI specification (commands, bridges, formats, plan)
- `docs/DECISIONS.md` → accepted decisions (source of truth if conflict)

If a decision is not in the specs, do not implement it. Propose a documentation change first.

## Git workflow (BLOCKING — do this BEFORE writing any code)

1. NEVER commit directly to `main`. Always create a feature branch first.
2. Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`
3. Commits: `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, `chore(scope): ...`
4. One PR per feature. Include: what/why, list of changes, how to test.
5. Clean up branch after merge.

If you are on `main`, stop and create a branch before doing anything else.

## What NOT to do

- Do not add dependencies not listed in `docs/CLI_SPEC.md` without asking.
- Do not create new documentation trees. Update existing docs instead.
- Do not move files or rename directories unless explicitly instructed.