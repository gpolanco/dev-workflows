---
name: accessibility
description: "Accessibility best practices for AI coding agents"
version: "0.1.0"
scope: conventions
tags: [frontend, accessibility, a11y, html]
---

## Semantic HTML

- Use the correct HTML element for the job. `<button>` for
  actions, `<a>` for navigation, `<input>` for data entry.
  Never put an `onClick` on a `<div>` or `<span>`.

- Structure headings in order: one `<h1>` per page, then
  `<h2>`, `<h3>`, and so on. Never skip heading levels
  for styling purposes.

- Use landmark elements: `<nav>`, `<main>`, `<aside>`,
  `<header>`, `<footer>`. Screen readers use these to
  let users jump between sections.

- Use `<ul>` or `<ol>` for lists of items, `<table>` for
  tabular data, `<form>` to wrap form controls. Semantic
  structure communicates meaning without visual cues.

## ARIA

- Use ARIA only when native HTML cannot express the semantics.
  A `<button>` is always better than `<div role="button">`.

- Add `aria-label` to icon-only buttons and links that have
  no visible text. The label must describe the action, not
  the icon (e.g. "Close dialog", not "X icon").

- Use `aria-describedby` to associate help text or error
  messages with form inputs. Use `aria-live="polite"` on
  regions that update dynamically so screen readers announce
  changes.

- Never use `aria-hidden="true"` on focusable elements.
  If something is hidden from assistive tech, it must also
  be removed from the tab order.

## Keyboard

- Every interactive element must be reachable with Tab and
  activable with Enter or Space. Test by putting your mouse
  in a drawer and navigating with keyboard only.

- Maintain a visible focus indicator on all interactive
  elements. Never set `outline: none` without providing a
  custom focus style that meets contrast requirements.

- Trap focus inside modals and dialogs. When a modal opens,
  focus the first focusable element. When it closes, return
  focus to the trigger element.

- Support Escape to close modals, dropdowns, and popovers.
  Users expect it and it is required by WCAG.

## Visual

- Meet WCAG contrast minimums: 4.5:1 for normal text
  (under 18px or 14px bold), 3:1 for large text and
  UI components.

- Never rely on color alone to convey information. Pair
  color with icons, text labels, or patterns. Error states
  need both red color and an error icon or message.

- Write descriptive alt text for informational images.
  Describe what the image communicates, not what it looks
  like. Use `alt=""` for purely decorative images.

- Every form input must have a visible `<label>` element
  linked via `for`/`id`. Placeholder text is not a label
  and disappears on input.

- Ensure touch targets are at least 44x44px. Small links
  and icon buttons need padding to meet this minimum.
