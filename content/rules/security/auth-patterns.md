---
name: auth-patterns
description: "Authentication and authorization best practices"
version: "0.1.0"
scope: security
tags: [security, auth, authentication, authorization]
---

## Authentication

- Never store passwords in plain text. Always hash with
  bcrypt, scrypt, or argon2 using a unique salt per password.

- Use short-lived access tokens (15 minutes or less) paired
  with longer-lived refresh tokens. Rotate refresh tokens
  on every use.

- Never store sensitive tokens in `localStorage` or
  `sessionStorage`. Use `httpOnly`, `Secure`, `SameSite`
  cookies for tokens that grant access to protected resources.

- For SPAs, use OAuth 2.0 Authorization Code flow with PKCE.
  Never use Implicit flow, it exposes tokens in the URL.

- Offer TOTP-based two-factor authentication as a minimum.
  Avoid SMS-based 2FA, it is vulnerable to SIM swapping
  and interception.

## Sessions

- Invalidate all sessions and tokens when a user changes
  their password, resets credentials, or explicitly logs out.

- Set absolute session timeouts. No session should live
  indefinitely regardless of activity. Force re-authentication
  for sensitive operations.

- Bind sessions to the user agent and IP range when possible.
  Reject sessions that suddenly appear from a different
  context.

- Store session data server-side. The session ID in the
  cookie should be an opaque random value, not a JWT
  containing user data.

## Authorization

- Verify permissions on the server for every request. Never
  trust the client to enforce access control. Hiding a button
  in the UI is not authorization.

- Apply the principle of least privilege. Grant the minimum
  permissions required for the task. Default to deny and
  explicitly allow.

- Check authorization at the resource level, not just the
  route level. A user who can access `/api/orders` may not
  be authorized to access `/api/orders/123` if that order
  belongs to someone else.

- Log all authorization failures, privilege escalations, and
  sensitive actions. These logs are your audit trail and your
  early warning system.

## Common Pitfalls

- Apply rate limiting to all authentication endpoints: login,
  registration, password reset, and token refresh. Use
  exponential backoff after repeated failures.

- Protect every state-changing request against CSRF. Use
  CSRF tokens or `SameSite=Strict` cookies. GET requests
  must never mutate state.

- Never reveal whether an account exists in error responses.
  "Invalid email or password" for login, "If this email
  exists, we sent a reset link" for password reset.

- Validate and sanitize all auth-related input on the server.
  Email format, password length, token format. Client-side
  validation is a convenience, not a security measure.
