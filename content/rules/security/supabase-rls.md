---
name: supabase-rls
description: "Supabase Row-Level Security enforcement and auth patterns"
version: "0.1.0"
scope: security
tags: [supabase, rls, security, database]
---

## RLS Policies

- Every new table must have RLS policies before merging.
  Enable RLS with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  and create at least one policy per operation (SELECT, INSERT,
  UPDATE, DELETE) as needed.

- Always use `auth.uid()` in RLS policies to scope data to
  the authenticated user. Never rely on client-provided
  user IDs in queries.

- Test RLS policies in isolation. Write SQL tests that verify
  access is denied for unauthorized users before merging.

## Auth Keys

- Never expose the `service_role` key to the client.
  Use the anon key in browser code and the `service_role` key
  only in server-side or admin contexts.

- Store Supabase keys in environment variables. Never hardcode
  keys in source files or commit them to version control.
