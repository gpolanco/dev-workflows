# Official Rules

Rules for AI coding agents, distributed via `devw pull`.

## Available Rules

| Rule | Category | Description | Command |
|------|----------|-------------|---------|
| `typescript/strict` | TypeScript | Strict TypeScript conventions | `devw pull typescript/strict` |
| `javascript/react` | JavaScript | React conventions and best practices | `devw pull javascript/react` |
| `javascript/nextjs` | JavaScript | Next.js App Router patterns and RSC | `devw pull javascript/nextjs` |
| `css/tailwind` | CSS | Utility-first Tailwind conventions | `devw pull css/tailwind` |
| `testing/vitest` | Testing | Vitest testing patterns | `devw pull testing/vitest` |
| `security/supabase-rls` | Security | Supabase RLS enforcement | `devw pull security/supabase-rls` |

## Usage

```bash
# List all available rules
devw pull --list

# Pull a specific rule
devw pull typescript/strict

# Preview without writing
devw pull typescript/strict --dry-run

# Force overwrite
devw pull typescript/strict --force
```

## Rule Format

Each rule file uses YAML frontmatter and Markdown bullets:

```markdown
---
name: rule-name
description: "Short description"
version: "0.1.0"
scope: conventions
tags: [tag1, tag2]
---

## Section

- Rule text as a bullet.
  Continuation indented.
```
