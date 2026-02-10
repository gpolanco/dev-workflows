# dev-workflows

## 0.3.0

### Minor Changes

- 050eaae: ### CLI

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

## 0.2.2

### Patch Changes

- 40ee29b: Landing page copy update and README refresh

  - Update hero headline, subtitle, and CTA text
  - Rewrite problem section heading and description
  - Update block cards descriptions (typescript-strict, react-conventions, testing-basics)
  - Add trajectory section with roadmap (v0.2, v0.3, v1.0)
  - Update CTA section heading and install command description
  - Update footer tagline
  - Update README with new project description, commands table, rule blocks, and bridges
  - Replace Amp bridge with VS Code Copilot in README bridges table

## 0.2.1

### Patch Changes

- 35672b2: UX polish: unified output module, improved feedback for all commands, interactive add/remove, compile shows file list and timing

## 0.2.0

### Minor Changes

- af87991: Add custom scopes (kind:name)
  Add Windsurf and Copilot bridges
  Add devw explain command

## 0.1.4

### Patch Changes

- 4bca317: add inquirer to select options

## 0.1.3

### Patch Changes

- e208a74: Improve README with problem statement, Node.js requirement, output example, and remove internal spec link.

## 0.1.2

### Patch Changes

- 7415823: Add npm metadata (license, author, repository, homepage, keywords, engines) and read version dynamically from package.json instead of hardcoding it.
