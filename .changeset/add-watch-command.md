---
"dev-workflows": minor
---

### CLI

- Add `devw watch` command — watches `.dwf/` for YAML changes and recompiles automatically
- Extract `executePipeline` from compile with structured return types (`BridgeResult`, `CompileResult`)
- Add `reload` icon to shared `ICONS` in `utils/ui.ts`
- Add chokidar v3 dependency for filesystem watching

### Documentation

- Add `devw watch` to README commands table
- Add `docs/commands/watch.mdx` for Mintlify docs site
- Register watch page in `docs.json` navigation

### Landing

- Add watch tab to terminal demo section
- Add global `*:focus-visible` with `var(--accent)` for consistent focus styling
- Fix active tab border to use `var(--accent)`
