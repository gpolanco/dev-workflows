# Official Rules

Rules for AI coding agents, distributed via `devw add`.

## Available Rules

| Rule | Category | Description | Command |
|------|----------|-------------|---------|
| `typescript/strict` | TypeScript | Strict TypeScript conventions | `devw add typescript/strict` |
| `javascript/react` | JavaScript | React conventions and best practices | `devw add javascript/react` |
| `javascript/nextjs` | JavaScript | Next.js App Router patterns and RSC | `devw add javascript/nextjs` |
| `css/tailwind` | CSS | Utility-first Tailwind conventions | `devw add css/tailwind` |
| `testing/vitest` | Testing | Vitest testing patterns | `devw add testing/vitest` |
| `security/supabase-rls` | Security | Supabase RLS enforcement | `devw add security/supabase-rls` |

## Usage

```bash
# List all available rules
devw add --list

# Add a specific rule
devw add typescript/strict

# Interactive mode — browse categories and select
devw add

# Preview without writing
devw add typescript/strict --dry-run

# Force overwrite
devw add typescript/strict --force
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
