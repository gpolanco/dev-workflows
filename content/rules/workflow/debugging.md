---
name: debugging
description: "Systematic debugging methodology for AI coding agents"
version: "0.1.0"
scope: workflow
tags: [workflow, debugging, methodology]
---

## Process

- Follow a systematic order: reproduce, isolate, diagnose,
  fix, verify, document. Skipping steps leads to patches
  that mask the real problem.

- Always reproduce the bug before attempting a fix. If you
  cannot reproduce it, you cannot verify the fix. Get the
  exact steps, inputs, and environment.

- Isolate the problem to the smallest reproducible case.
  Remove unrelated code, dependencies, and data until only
  the bug remains.

- Make one change at a time. Changing five things and hoping
  something works is not debugging, it is guessing. Change
  one variable, test, repeat.

- If a fix works but you cannot explain why, do not accept
  it. Understand the root cause. Unexplained fixes hide
  deeper issues that will resurface.

## Techniques

- Read the full error message and stack trace before doing
  anything else. The answer is often in the message you
  skipped.

- Use binary search to locate bugs in large codebases.
  Comment out half the code, test, narrow down which half
  contains the bug, repeat.

- Check your assumptions first. Verify that the function
  is actually called, the variable has the value you expect,
  and the branch you think runs actually executes.

- Rubber duck it. Explain the problem out loud, step by
  step. Forcing yourself to articulate the expected vs actual
  behavior often reveals the gap.

- If you are stuck for more than 30 minutes without progress,
  change your approach. Re-read the documentation, check
  recent changes in git, or step away and come back fresh.

## Logging

- Log at system boundaries: API calls, database queries,
  event handlers, and external service integrations. These
  are where bugs hide.

- Use log levels consistently: `error` for failures that
  need immediate attention, `warn` for unexpected but
  recoverable situations, `info` for normal flow milestones,
  `debug` for detailed diagnostic data.

- Include context in log messages: the function name, relevant
  IDs, and input values. A log that says "error occurred"
  is useless. A log that says "payment failed for order
  abc-123: insufficient funds" is actionable.

- Never ship debugging logs to production. Remove
  `console.log` and `print` statements before committing.
  Use a structured logging library for persistent logs.
