---
name: performance
description: "Frontend performance optimization rules"
version: "0.1.0"
scope: performance
tags: [frontend, performance, core-web-vitals]
---

## Loading

- Lazy load routes and heavy components with dynamic imports.
  Only the code needed for the current view should load
  on initial page render.

- Defer non-critical scripts with `defer` or `async`.
  Third-party analytics, chat widgets, and tracking pixels
  should never block the critical rendering path.

- Preload critical assets: the main font, hero image, and
  above-the-fold CSS. Use `<link rel="preload">` with the
  correct `as` attribute.

- Avoid waterfalls. Do not fetch data, then fetch more data
  based on the result, then render. Parallelize requests and
  colocate data fetching with the component that needs it.

## Rendering

- Reserve explicit dimensions for images, videos, and embeds
  with `width` and `height` attributes or CSS `aspect-ratio`.
  This prevents layout shifts (CLS).

- Minimize DOM depth and node count. Deeply nested markup
  slows style recalculation and layout. Flatten structure
  where possible.

- Avoid forced synchronous layouts. Do not read layout
  properties (`offsetHeight`, `getBoundingClientRect`) then
  immediately write styles in a loop.

- Minimize client-side JavaScript that blocks interactivity.
  Move computation to the server, web workers, or build time
  when possible.

## Assets

- Use modern image formats: WebP or AVIF with a fallback.
  Serve responsive images with `srcset` and `sizes` to avoid
  sending oversized files to small screens.

- Load images below the fold with `loading="lazy"`. Eager
  load only the hero image and above-the-fold content.

- Limit fonts to two families maximum. Preload the primary
  font and use `font-display: swap` to prevent invisible
  text during load.

- Prefer build-time or utility-first CSS over runtime CSS-in-JS.
  Runtime style injection adds JavaScript overhead and delays
  first paint.

## Monitoring

- Do not optimize without measuring. Run Lighthouse or
  WebPageTest before and after changes. Optimize the
  bottleneck, not what you assume is slow.

- Track Core Web Vitals in production: LCP under 2.5s,
  INP under 200ms, CLS under 0.1. These are the metrics
  that affect real users.

- Set performance budgets for bundle size and load time.
  Fail the build or flag in CI when budgets are exceeded.

- Cache aggressively. Use content hashes in asset filenames
  for long-lived cache headers. Serve static assets from a
  CDN with proper `Cache-Control`.
