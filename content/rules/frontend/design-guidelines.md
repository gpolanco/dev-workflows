---
name: design-guidelines
description: "UI design principles for AI coding agents"
version: "0.1.0"
scope: design
tags: [frontend, design, ui, ux]
---

## Layout

- Use a consistent spacing system based on a 4px or 8px grid.
  Every margin, padding, and gap should be a multiple of the
  base unit. No magic numbers.

- Establish clear visual hierarchy with size, weight, and
  spacing. The most important element on the page should be
  immediately obvious without reading a single word.

- Use whitespace deliberately to group related content and
  separate unrelated content. Whitespace is a design tool,
  not leftover space.

- Limit content width for readability. Body text should not
  exceed 65-75 characters per line. Use `max-width` on
  text containers.

## Typography

- Use at most two font families: one for headings, one for
  body. A single family with varied weights is often enough.

- Define a type scale and stick to it. Use 4-6 distinct sizes
  with a consistent ratio (e.g. 1.25 or 1.333). Never pick
  arbitrary font sizes.

- Set line-height relative to font size: 1.5 for body text,
  1.2-1.3 for headings. Tighter leading on large text, looser
  on small text.

- Use font weight to create contrast, not font size alone.
  Pair a bold heading with regular body text rather than
  relying on size differences.

## Color

- Define a limited palette: one primary, one neutral scale,
  and semantic colors (success, error, warning, info).
  Resist adding colors outside this set.

- Ensure sufficient contrast ratios: 4.5:1 minimum for body
  text, 3:1 for large text and UI elements. Test with a
  contrast checker, do not eyeball it.

- Use color semantically. Red means destructive or error,
  green means success, yellow means warning. Do not repurpose
  semantic colors for decoration.

- Support dark mode from the start if the project requires it.
  Use CSS custom properties or theme tokens for all colors,
  never hardcode hex values in components.

## Components

- Build components with clear visual states: default, hover,
  focus, active, disabled, and loading. Every interactive
  element needs at least hover and focus.

- Use consistent border-radius, shadow, and border values
  across all components. Define these as design tokens and
  reference them everywhere.

- Make clickable areas at least 44x44px on touch devices.
  Pad small icons and links to meet this minimum target size.

- Show loading and empty states. Never leave users staring
  at a blank screen or an unresponsive button.

## Responsive

- Design mobile-first. Start with the smallest screen and
  add complexity at wider breakpoints using `min-width`
  media queries.

- Use 2-3 breakpoints maximum. More breakpoints create more
  maintenance and more inconsistency. Fluid layouts with
  `clamp()` reduce the need for breakpoints.

- Never hide critical content or functionality on mobile.
  Adapt the layout, do not remove features.

- Test at real device widths (320px, 375px, 768px, 1024px,
  1440px), not just at breakpoint boundaries.

## Taste

- Make concrete design decisions. Pick a specific visual
  direction and commit to it. Vague, generic aesthetics
  scream "AI-generated."

- Avoid gratuitous gradients, excessive rounded corners,
  and decorative elements that do not serve the content.
  Restraint is a design skill.

- Steal from good design, not from templates. Reference
  real products you admire and adapt their patterns to
  your context.
