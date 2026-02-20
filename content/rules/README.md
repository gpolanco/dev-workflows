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
| `frontend/design-guidelines` | Frontend | UI design principles for AI coding agents | `devw add frontend/design-guidelines` |
| `frontend/accessibility` | Frontend | Accessibility best practices | `devw add frontend/accessibility` |
| `frontend/performance` | Frontend | Frontend performance optimization rules | `devw add frontend/performance` |
| `workflow/git-conventions` | Workflow | Git workflow and commit conventions | `devw add workflow/git-conventions` |
| `workflow/debugging` | Workflow | Systematic debugging methodology | `devw add workflow/debugging` |
| `security/auth-patterns` | Security | Authentication and authorization best practices | `devw add security/auth-patterns` |
| `workflow/spec-driven` | Workflow | Spec-driven development workflow | `devw add workflow/spec-driven` |

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
