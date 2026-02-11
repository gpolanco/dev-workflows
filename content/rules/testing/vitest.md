---
name: vitest
description: "Vitest testing patterns and best practices"
version: "0.1.0"
scope: testing
tags: [vitest, testing, unit-tests]
---

## Test Structure

- Use descriptive test names that explain the expected behavior.
  Follow the pattern: `should [expected behavior] when [condition]`.

- Structure tests with Arrange-Act-Assert (AAA) pattern.
  Separate setup, execution, and verification into distinct
  sections for readability.

- Group related tests with `describe` blocks. One `describe`
  per function or feature under test.

## Assertions

- Test behavior, not implementation details. Avoid asserting
  on internal state, private methods, or specific function calls
  unless testing integration points.

- Prefer specific assertions (`toEqual`, `toContain`, `toThrow`)
  over generic ones (`toBeTruthy`). Specific assertions give
  better failure messages.

## Mocking

- Only mock at system boundaries: network requests, databases,
  file system, and third-party services. Do not mock internal
  modules or utility functions.

- Use `vi.fn()` for function spies and `vi.mock()` for module
  mocks. Restore all mocks after each test with `afterEach`.
