# Joe Real Estate OS

Production-quality real estate CRM and operating system.

## Stack

- Next.js 16 (App Router) + TypeScript
- PostgreSQL 16 + Prisma 7
- Better Auth
- Tailwind CSS + shadcn/ui

## Quick start

1. Copy env: `cp .env.example .env`
2. Set `BETTER_AUTH_SECRET` (32+ random chars)
3. Set `DATABASE_URL` to either:
   - **Supabase** (project `agentcrm` / `plyzkmerzfmkreqrpynw`): copy the URI from [Database settings](https://supabase.com/dashboard/project/plyzkmerzfmkreqrpynw/settings/database)
   - **Local Docker**: `docker compose up -d` then use the URL in `.env.example`
4. Generate client: `npx prisma generate`
5. If using a fresh local DB: `npx prisma migrate deploy`
6. Seed (optional, never production): `npm run db:seed`
7. Dev server: `npm run dev`
8. Open [http://localhost:3000](http://localhost:3000)

### Supabase notes

- Schema is applied on Supabase with RLS enabled (deny-by-default for the Data API).
- The app uses **Better Auth + Prisma** over the Postgres connection string — not Supabase Auth.
- Never expose the database password or service role key to the browser.

### Vercel env vars

| Name | Notes |
|------|--------|
| `DATABASE_URL` | Supabase pooler URI (transaction mode + `?pgbouncer=true`) |
| `BETTER_AUTH_SECRET` | Same strong secret as local |
| `BETTER_AUTH_URL` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Same as `BETTER_AUTH_URL` |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest |
| `npm run db:seed` | Load labeled `[SEED]` development data |
| `npm run db:migrate` | `prisma migrate dev` |

## Documentation

See [`docs/`](./docs/) for product requirements, architecture, database, roadmap, AI, integrations, security, compliance, and ADRs.

## Phase 1 scope

Auth, multi-tenant orgs, contacts, properties, leads/pipeline, tasks, dashboard, search. AI/comms/MLS are interfaces + mocks only.
