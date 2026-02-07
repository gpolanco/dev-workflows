# dev-workflows

> Define AI coding rules once. Compile to CLAUDE.md, .cursor/rules, GEMINI.md.

AI coding tools (Claude Code, Cursor, Gemini CLI) each use different config files for project rules. dev-workflows lets you define rules once in YAML and compile them to each tool's native format. No duplication, no drift.

## Quick start

```bash
npx dev-workflows init
```

Requires Node.js >= 22.

## Usage

```bash
devw init                        # set up .dwf/ in your project
devw add typescript-strict       # install a rule block
devw compile                     # generate CLAUDE.md, .cursor/rules, GEMINI.md
```

## What it generates

Running `devw compile` produces tool-specific files with your rules between markers:

```md
<!-- BEGIN dev-workflows -->
- Never use `any`. Use `unknown` when the type is truly unknown.
- Always declare explicit return types on exported functions.
- Prefer union types over enums. Use `as const` objects when you need runtime values.
<!-- END dev-workflows -->
```

Content outside the markers is preserved — your manual notes stay intact.

## Available blocks

| Block | Description |
|-------|-------------|
| `typescript-strict` | Strict TypeScript conventions (no any, explicit returns) |
| `react-conventions` | Hooks rules, component patterns, naming |
| `nextjs-approuter` | App Router patterns, RSC, server actions |
| `tailwind` | Utility-first CSS conventions and design tokens |
| `testing-basics` | Test naming, AAA pattern, mock boundaries |
| `supabase-rls` | Row-Level Security enforcement and auth patterns |

## Commands

| Command | Description |
|---------|-------------|
| `devw init` | Initialize config in current project |
| `devw compile` | Compile rules to editor-specific formats |
| `devw add <block>` | Install a rule block |
| `devw remove <block>` | Remove an installed block |
| `devw list` | List available blocks and rules |
| `devw doctor` | Validate configuration |

## License

MIT
