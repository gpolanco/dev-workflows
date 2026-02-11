---
name: nextjs
description: "Next.js App Router patterns and React Server Components"
version: "0.1.0"
scope: architecture
tags: [nextjs, react, app-router, rsc]
---

## Server Components

- Minimize `"use client"` directives. Default to Server Components.
  Only add `"use client"` when the component needs browser APIs,
  event handlers, or React hooks that require client state.

- Fetch data in Server Components or server actions, not in
  client components with `useEffect`. Use React Suspense for
  loading states.

- Keep Server Components free of side effects. Data fetching
  and rendering only; mutations belong in server actions.

## Routing

- Follow the App Router file conventions: `page.tsx`, `layout.tsx`,
  `loading.tsx`, `error.tsx`, `not-found.tsx`. Do not create custom
  routing abstractions.

- Use route groups `(group)` to organize routes without affecting
  the URL structure. Use parallel routes and intercepting routes
  when needed.

## Server Actions

- Prefer server actions for form submissions and data mutations.
  Define them with `"use server"` in a separate file or at the
  top of an async function.

- Validate all inputs in server actions. Never trust data coming
  from the client even in server-side code.
