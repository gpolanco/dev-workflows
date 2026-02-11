---
name: strict
description: "Strict TypeScript conventions for professional codebases"
version: "0.1.0"
scope: conventions
tags: [typescript, strict, types]
---

## Type Safety

- Never use `any`. Use `unknown` when the type is truly unknown,
  then narrow with type guards.

- Always declare explicit return types on exported functions.
  Inferred types are fine for internal/private functions.

- Never use non-null assertion (`!`). Handle null/undefined explicitly
  with optional chaining, nullish coalescing, or type guards.

## Types and Enums

- Prefer union types over enums.
  Use `as const` objects when you need runtime values.

- Prefer `interface` for object shapes that may be extended.
  Use `type` for unions, intersections, and mapped types.

- Use `satisfies` to validate object literals against a type
  while preserving the narrowest inferred type.

## Generics

- Name generic parameters descriptively when the meaning
  is not obvious. Prefer `TItem` over `T` in complex signatures.

- Constrain generic parameters with `extends` to communicate
  the expected shape and catch misuse at compile time.
