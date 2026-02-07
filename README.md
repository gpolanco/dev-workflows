# dev-workflows

> Define AI coding rules once. Compile to CLAUDE.md, .cursor/rules, GEMINI.md.

## Quick start

```bash
npx dev-workflows init
```

## Usage

```bash
devw init                        # set up .dwf/ in your project
devw add typescript-strict       # install a rule block
devw compile                     # generate CLAUDE.md, .cursor/rules, GEMINI.md
```

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

## Documentation

Full specification: [docs/CLI_SPEC.md](docs/CLI_SPEC.md)

## License

MIT
