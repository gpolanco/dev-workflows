---
name: spec-driven
description: "Spec-driven development workflow: spec, plan, build, ship"
version: "0.1.0"
scope: workflow
tags: [workflow, spec-driven, methodology]
---

## Feature Development

- Every new feature MUST start with a spec. Use `/spec <feature-name>` to generate one through guided questions. Never jump straight to code.
- After the spec is approved, generate an implementation plan with `/plan docs/specs/<feature-name>.md`. The plan breaks work into commit-ready steps.
- Execute the plan step by step with `/build <plan-path>`. Each step is verified with tests and committed independently.
- When you learn something new (a mistake, a pattern, a convention), capture it with `/learn` so the knowledge persists.

## Quality Gates

- Never skip the spec phase for features that touch more than 3 files. Small fixes and typos can go directly to implementation.
- Every plan step must include what tests to write or update. No step is complete without passing verification.
- If a step fails verification after 3 attempts, stop and ask for human guidance instead of forcing a solution.

## Specs

- Specs live in `docs/specs/` and follow the feature-spec template. Keep them concise but complete.
- A good spec answers: what problem, for whom, what constraints, what success looks like, and what is explicitly out of scope.
- Update the spec if requirements change during implementation. The spec is the source of truth.
