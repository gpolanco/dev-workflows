# dev-workflows

[![npm version](https://img.shields.io/npm/v/dev-workflows)](https://www.npmjs.com/package/dev-workflows)
[![license](https://img.shields.io/npm/l/dev-workflows)](./LICENSE)
[![docs](https://img.shields.io/badge/docs-dev--workflows.com-blue)](https://docs.dev-workflows.com)

Define rules once. Compile them everywhere.

A local-first CLI to define AI coding rules and compile them for every editor and agent.

---

## Quick Start

```bash
npx dev-workflows init
devw add react-conventions
devw compile
```

---

## What it does

```
.dwf/rules/*.yml        →  devw compile  →  CLAUDE.md
                                             .cursor/rules
                                             GEMINI.md
```

You define rules in YAML. The compiler generates each editor's native format. Change a rule, recompile — every editor stays in sync.

---

## Commands

| Command | Description |
|---------|-------------|
| `devw init` | Initialize a `.dwf/` ruleset in your project |
| `devw add <block>` | Install a prebuilt rule block |
| `devw remove <block>` | Remove a rule block |
| `devw compile` | Generate editor-specific rule files |
| `devw watch` | Watch `.dwf/` and recompile on changes |
| `devw doctor` | Validate config and detect rule drift |
| `devw list rules` | List all active rules |
| `devw list blocks` | List installed blocks |
| `devw list tools` | List configured editors |

---

## Rule Blocks

Prebuilt rule blocks you can stack. Install with `devw add <block>`.

| Block | Purpose |
|-------|---------|
| `typescript-strict` | Enforces strict TypeScript patterns |
| `react-conventions` | Common React component and hook rules |
| `nextjs-approuter` | Next.js App Router best practices |
| `tailwind` | Utility-first styling conventions |
| `supabase-rls` | Database security and RLS rules |
| `testing-basics` | Test naming and structure rules |

---

## Bridges

Bridges generate editor-compatible rule files. One adapter per tool.

| Tool | Output |
|------|--------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/devworkflows.mdc` |
| Gemini CLI | `GEMINI.md` |
| Windsurf | `.windsurfrules` |
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