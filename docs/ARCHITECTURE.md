# Architecture — Joe Real Estate OS

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 16 App Router, React 19, TypeScript strict |
| UI | Tailwind CSS + shadcn/ui |
| DB | PostgreSQL 16, Prisma 7 + `@prisma/adapter-pg` |
| Auth | Better Auth (email/password); CRM tenancy is our domain |
| Validation | Zod |
| Tests | Vitest (unit/domain); Playwright later for e2e |
| Deploy target | Vercel + hosted Postgres (future) |

## Layering

```
UI (app router pages / components)
        ↓
Server Actions / Route Handlers
        ↓
Domain services (src/domain/*)
        ↓
Prisma / adapters (src/providers/*)
        ↓
PostgreSQL
```

Rules:

- No Prisma calls from React components.
- Domain services own business rules and tenant scoping.
- Server Actions validate input with Zod, then call services.
- Providers (email, SMS, AI, MLS) are interfaces + mocks until credentials exist.

## Multi-tenancy

```
Organization
  ├── Team
  ├── Membership (User + role)
  └── all CRM records (organizationId)
```

Roles: `OWNER | ADMIN | AGENT | ASSISTANT`.

Every query that returns tenant data must filter by `organizationId` from the authenticated membership. Next.js `proxy.ts` cookie presence is UX-only; `auth.api.getSession()` + membership lookup is the security boundary.

## Module map (Phase 1)

```
src/
  app/(auth)/          # sign-in, sign-up
  app/(app)/           # authenticated CRM
  components/          # UI + layout
  domain/              # contacts, opportunities, properties, tasks, activities, search, orgs
  lib/                 # db, auth, auth-client
  providers/           # ai, email, sms, voice, mls, storage, esign
  server/              # audit helpers, session/org context
```

## Event orientation (foundation)

Domain mutations emit structured activities and audit logs. Future consumers:

- Workflow engine
- Notifications
- Scoring
- AI analysis

Phase 1 writes `Activity`, `AuditLog`, and `AssignmentEvent` records; it does not yet run a generic event bus.

## Person vs deal

- **Contact** = person (sphere, vendor, past client, etc.)
- **Opportunity** = pipeline/deal object (buyer or seller intent)
- Product “Leads” UI reads/writes Opportunities in early lifecycle stages

## AI readiness

- `ContactFact` stores structured memory with source + confidence
- AI provider interface exists; Phase 1 does not call LLMs
- AI Brief on contact detail shows stored facts only — never fabricated narrative

## Extensibility

- JSON columns for preferences/custom fields
- Pipeline stages configurable in DB
- Integration adapters swappable without rewriting domain logic
