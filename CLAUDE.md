# Dev Workflows

CLI tool that compiles developer rules into editor-specific config files (CLAUDE.md, .cursor/rules, GEMINI.md).

## Stack

- Monorepo with pnpm workspaces
- CLI in `packages/cli/` (TypeScript, commander)
- Rules in `content/rules/` (Markdown with YAML frontmatter, hosted on GitHub)
- Tests with node:test

## Architecture

- `content/rules/` → official rule files (Markdown), fetched from GitHub via `devw add`
- `content/blocks/` → local prebuilt blocks installed via `devw add <block-id>`
- `packages/cli/src/bridges/` → per-tool adapters that translate rules → native format
- Bridges only translate. They do not add new intent or logic.

## Key commands

```bash
pnpm install                    # install deps
pnpm build                      # build CLI
pnpm test                       # run tests
pnpm dev                        # dev mode
devw add                        # interactive: browse and install rules from registry
devw add typescript/strict      # direct: install specific rule
devw add --list                 # list available rules
```

## Specs (read before implementing)

- `openspec/specs/cli/spec.md` → CLI spec (commands, bridges, UI, registry) — current state
- `openspec/specs/decisions/spec.md` → accepted decisions (source of truth if conflict)
- `openspec/specs/docs/spec.md` → Mintlify documentation site spec
- `openspec/specs/theme/spec.md` → design system for the landing page
- `openspec/changes/pull-command/tasks.md` → `feat/pull-command` branch state (pending merge)
- `openspec/` is gitignored — internal specs not published

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

- Do not add dependencies not listed in `openspec/specs/cli/spec.md` without asking.
- Do not create new documentation trees. Update existing docs instead.
- Do not move files or rename directories unless explicitly instructed.
