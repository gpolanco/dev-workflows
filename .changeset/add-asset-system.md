---
"dev-workflows": minor
---

Add asset system for commands, templates, hooks, and presets

- **Commands**: `devw add command/spec` downloads slash commands that deploy to `.claude/commands/`
- **Templates**: `devw add template/feature-spec` installs spec templates to `docs/specs/`
- **Hooks**: `devw add hook/auto-format` merges editor hooks into `.claude/settings.local.json`
- **Presets**: `devw add preset/spec-driven` installs a full workflow bundle (rules + commands + templates + hooks)
- **Init with preset**: `devw init --preset spec-driven` scaffolds a project with a complete workflow
- **Asset-aware commands**: `list`, `remove`, `doctor`, `watch`, and `compile` all support the new asset types
- **Content**: 4 slash commands (spec, plan, build, learn), 1 template (feature-spec), 1 hook (auto-format), 1 preset (spec-driven), 1 rule (workflow/spec-driven)
