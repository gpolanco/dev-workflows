---
name: tailwind
description: "Utility-first Tailwind CSS conventions and design tokens"
version: "0.1.0"
scope: conventions
tags: [tailwind, css, styling]
---

## Utilities

- Use Tailwind utility classes for all styling. Do not write
  custom CSS unless absolutely necessary (e.g. complex
  animations or third-party overrides).

- Avoid `@apply` in CSS files. Extract reusable patterns into
  React components instead of creating CSS abstractions.

- Keep className strings readable. Break long class lists across
  multiple lines and group related utilities together.

## Design Tokens

- Use Tailwind's design tokens (spacing, colors, typography)
  from the theme config. Avoid arbitrary values like
  `w-[137px]`; prefer the closest token.

- Extend the theme in `tailwind.config` for project-specific
  tokens. Do not hardcode colors or spacing outside the config.
