---
name: git-conventions
description: "Git workflow and commit conventions"
version: "0.1.0"
scope: workflow
tags: [git, workflow, conventions]
---

## Commits

- Follow Conventional Commits: `feat:`, `fix:`, `docs:`,
  `chore:`, `refactor:`, `test:`. Add an optional scope
  in parentheses: `feat(auth): add login flow`.

- Write the subject line in imperative mood: "add feature",
  not "added feature" or "adding feature". Keep it under
  72 characters.

- One commit equals one logical change. Do not mix a refactor
  with a feature, or a bug fix with a formatting cleanup.
  Each commit should be reviewable in isolation.

- Write a body when the subject alone does not explain why.
  Separate subject from body with a blank line. The body
  explains motivation, not implementation.

- Never commit secrets, `.env` files, `node_modules`,
  build artifacts, or generated files. Add them to
  `.gitignore` before the first commit.

## Branches

- Use prefixed branch names: `feat/`, `fix/`, `chore/`,
  `docs/`, `refactor/`. Follow with a short kebab-case
  slug: `feat/add-login-flow`.

- Never commit directly to `main` or `master`. Always create
  a feature branch and merge through a pull request.

- Keep branches short-lived. A branch that lives for weeks
  will accumulate merge conflicts and delay feedback.
  Merge early and often.

- Delete branches after merging. Stale branches clutter
  the repo and confuse contributors.

## Pull Requests

- Write a descriptive title that summarizes the change.
  The description should explain what changed, why, and
  how to test it.

- Keep PRs small and focused. One feature or fix per PR.
  Large PRs take longer to review and are more likely to
  introduce bugs.

- Use squash merge for feature branches to keep the main
  branch history clean. Use merge commits for release
  branches when you need to preserve individual commits.

- Do not approve your own PR. Request review from at least
  one teammate. Address all review comments before merging.
