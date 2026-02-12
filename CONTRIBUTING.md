# Contributing to Dev Workflows

Thanks for your interest in contributing.

Dev Workflows aims to provide a **tool-agnostic core** for AI-assisted software development workflows, plus **bridges** for specific tools.

The project is intentionally opinionated:

* Core is the source of truth
* Bridges translate (they do not invent)
* The goal is governance + enforcement, not just config sync

---

## What we accept

### 1) Bridge maintenance

Tools change formats. Bridges must be kept compatible.

* Claude Code (`CLAUDE.md`, `.claude/`)
* Cursor (`.cursor/rules/*.mdc`)
* Gemini CLI (`GEMINI.md`)

### 2) New tool adapters

New adapters are welcome **only if they follow the architecture**:

* Must be generated from `content/core/`
* Must not duplicate content
* Must not require proprietary APIs

### 3) Workflow packs

Examples:

* UI workflows
* Backend workflows
* Release workflows

---

## What we do NOT accept

* Random prompt collections without a workflow
* Tool-specific logic inside `content/core/`
* Bridges that contain custom instructions not present in the core

---

## Development setup (Unix-first)

> This repo is still in early stage.

Expected setup:

```bash
pnpm install
pnpm build
```

---

## Pull Requests

Please keep PRs small and focused.

Checklist:

* [ ] The change is tool-agnostic (or strictly inside a bridge)
* [ ] No duplication across bridges
* [ ] Documentation updated if needed

---

## Reporting compatibility issues

If a tool changes its format, please open an issue with:

* Tool name + version
* What changed
* Minimal repro
* Proposed fix (optional)
