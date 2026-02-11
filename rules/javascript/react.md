---
name: react
description: "React conventions and best practices for AI coding agents"
version: "0.1.0"
scope: conventions
tags: [react, frontend, components, hooks]
---

## Components

- Always use named exports. Never use default exports.
  This applies to all files: components, utilities, hooks, and types.

- Use PascalCase for component names and their files
  (`UserProfile.tsx`). Use camelCase for hook files prefixed
  with `use` (`useAuth.ts`).

- Prefer composition over prop drilling. Use children,
  render props, or context for shared behavior rather than
  deeply nested prop chains.

- Colocate related files: component, hook, utils, and types
  in the same feature folder.

## Hooks

- Follow the Rules of Hooks: only call hooks at the top level,
  never inside conditions or loops. Custom hooks must start
  with `use`.

- Extract complex logic into custom hooks. A component should
  primarily handle rendering; business logic belongs in hooks.

- Use `useMemo` and `useCallback` only when there is a measured
  performance problem. Premature memoization adds complexity.

## Styling

- Avoid inline styles. Use CSS modules, Tailwind classes,
  or styled-components for styling.

- Keep className logic simple. Extract complex conditional
  classes into a helper or use a utility like `clsx`.
