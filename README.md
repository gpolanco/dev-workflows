# dev-workflows

[![npm version](https://img.shields.io/npm/v/dev-workflows)](https://www.npmjs.com/package/dev-workflows)
[![license](https://img.shields.io/npm/l/dev-workflows)](./LICENSE)
[![docs](https://img.shields.io/badge/docs-dev--workflows.com-blue)](https://docs.dev-workflows.com)

Define rules once. Compile them everywhere.

A local-first CLI to define AI coding rules, slash commands, templates, and hooks — compiled for every editor and agent.

---

## Quick Start

```bash
npx dev-workflows init
devw add typescript/strict
devw compile
```

Or bootstrap a full spec-driven workflow:

```bash
devw init --preset spec-driven -y
```

---

## What it does

```
.dwf/rules/*.yml        →  devw compile  →  CLAUDE.md
                                             .cursor/rules/devworkflows.mdc
                                             GEMINI.md
                                             .windsurf/rules/devworkflows.md
                                             .github/copilot-instructions.md

.dwf/assets/commands/*   →  devw compile  →  .claude/commands/*.md
.dwf/assets/templates/*  →  devw compile  →  docs/specs/*.md
.dwf/assets/hooks/*      →  devw compile  →  .claude/settings.local.json
```

You define rules in YAML and assets in Markdown/JSON. The compiler generates each editor's native format. Change a rule, recompile — every editor stays in sync.

---

## Commands

| Command | Description |
|---------|-------------|
| `devw init` | Initialize a `.dwf/` ruleset in your project |
| `devw init --preset <name>` | Initialize with a preset (e.g., `spec-driven`) |
| `devw add <category>/<name>` | Install a rule from the registry |
| `devw add command/<name>` | Install a slash command |
| `devw add template/<name>` | Install a spec template |
| `devw add hook/<name>` | Install an editor hook |
| `devw add preset/<name>` | Install a preset (bundle of rules + assets) |
| `devw remove <category>/<name>` | Remove a rule or asset |
| `devw compile` | Generate editor configs and deploy assets |
| `devw watch` | Watch `.dwf/` and recompile on changes |
| `devw doctor` | Validate config and detect drift |
| `devw list rules` | List all active rules |
| `devw list assets` | List installed assets |
| `devw list tools` | List configured editors |

---

## Rules Registry

Install rules from the registry with `devw add <category>/<rule>`.

| Rule | Description |
|------|-------------|
| `typescript/strict` | Strict TypeScript patterns |
| `javascript/react` | React component and hook conventions |
| `javascript/nextjs` | Next.js App Router best practices |
| `css/tailwind` | Utility-first styling conventions |
| `testing/vitest` | Test naming and structure rules |
| `security/supabase-rls` | Database security and RLS rules |
| `security/auth-patterns` | Authentication best practices |
| `frontend/design-guidelines` | UI/UX design conventions |
| `frontend/accessibility` | Accessibility (a11y) rules |
| `frontend/performance` | Frontend performance patterns |
| `workflow/git-conventions` | Git commit and branch conventions |
| `workflow/debugging` | Systematic debugging methodology |
| `workflow/spec-driven` | Spec-driven development workflow |

---

## Assets

Beyond rules, dev-workflows manages **assets** — slash commands, templates, and hooks that power AI workflows.

| Asset | Type | Description |
|-------|------|-------------|
| `command/spec` | Command | Generate a feature spec through guided questions |
| `command/plan` | Command | Create an implementation plan from a spec |
| `command/build` | Command | Execute a plan step by step with verification |
| `command/learn` | Command | Capture a lesson learned as a project rule |
| `template/feature-spec` | Template | Markdown template for feature specifications |
| `hook/auto-format` | Hook | Auto-format files after AI edits |

### Presets

Presets bundle rules and assets into a single install.

| Preset | Includes |
|--------|----------|
| `preset/spec-driven` | `workflow/spec-driven` rule + all 4 commands + feature-spec template + auto-format hook |

---

## Bridges

Bridges generate editor-compatible rule files. One adapter per tool.

| Tool | Output |
|------|--------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/devworkflows.mdc` |
| Gemini CLI | `GEMINI.md` |
| Windsurf | `.windsurf/rules/devworkflows.md` |
| VS Code Copilot | `.github/copilot-instructions.md` |

---

## Why

- Every AI coding tool requires rules in a different format.
- Maintaining the same rules in three files means they drift apart.
- dev-workflows makes your rules a single source of truth.

---

## Philosophy

- Local-first
- Source over output
- No accounts. No cloud.

---

## Contributing

Issues and PRs welcome. If you find a bug or have an idea, [open an issue](https://github.com/gpolanco/dev-workflows/issues).

## License

MIT
