# Security — Joe Real Estate OS

## Threat model (Phase 1)

Primary risks: cross-tenant data leaks, session abuse, secret exposure, XSS/injection via user content.

## Authentication

- Better Auth email/password.
- Sessions stored server-side (database).
- `proxy.ts` may check cookie presence for redirects only — **not** authorization.
- Layouts, Server Actions, and route handlers call `getSession()` and resolve membership.

## Authorization

- Role-based: OWNER, ADMIN, AGENT, ASSISTANT.
- Phase 1: any org member can CRUD org CRM data; destructive org settings reserved for OWNER/ADMIN.
- Every domain query includes `organizationId` from the caller’s membership.

## Secrets

- Never commit `.env` or API keys.
- `.env.example` documents required vars without values.
- Client bundles never receive server secrets.

## Data protection

- HTTPS in production (platform TLS).
- Parameterized queries via Prisma (SQL injection protection).
- Zod validation on inputs.
- React escaping + careful HTML rendering (no raw HTML from users in Phase 1).

## Audit

Mutations that change assignment, status, or sensitive fields write `AuditLog` / `AssignmentEvent`. Activity timeline records user-visible history.

## Rate limiting / CSRF

- Prefer framework defaults for Server Actions.
- Auth endpoints should use Better Auth rate-limit options where available.
- Expand API rate limits when public HTTP API ships.

## File handling (future)

Signed URLs, content-type allowlists, virus scanning consideration, tenant-scoped object keys.

## AI actions (Phase 8)

Propose-then-confirm only. Permission checks by `MembershipRole`; every confirm/deny audited (`AssistantAction`). External sends reuse consent gates; high-risk tools never auto-run.
