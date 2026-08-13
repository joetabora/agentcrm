# Architecture Decisions — Joe Real Estate OS

## ADR-001: Next.js 16 + Prisma 7 + Better Auth

**Status:** Accepted  
**Context:** Greenfield CRM needing App Router, typed DB, production auth without rewriting tenancy later.  
**Decision:** Next.js 16.3, Prisma 7 GA with `@prisma/adapter-pg`, Better Auth email/password.  
**Consequences:** Driver adapter required for Prisma 7. Auth identity tables separate from CRM Organization/Membership.

## ADR-002: Contact vs Opportunity (Lead as product surface)

**Status:** Accepted  
**Context:** Competitors blur “lead” and “contact”; modeling both as people causes schema pain.  
**Decision:** Contact = person. Opportunity = pipeline/deal. UI “Leads” maps to early-stage Opportunities.  
**Consequences:** One write path for deals; clearer relationship graph; scoring/routing attach to Opportunity.

## ADR-003: CRM tenancy owned by application

**Status:** Accepted  
**Context:** Auth vendors offer org plugins; coupling tenancy to vendor locks migration.  
**Decision:** `Organization` + `Membership` in our schema; Better Auth only authenticates users.  
**Consequences:** Signup must create org + OWNER membership; session helpers always resolve org context.

## ADR-004: Domain services over UI Prisma access

**Status:** Accepted  
**Decision:** Business logic lives in `src/domain/*`. UI uses Server Actions → services.  
**Consequences:** Slightly more files; enables future HTTP API and cleaner tests.

## ADR-005: Defer live AI and communications

**Status:** Accepted  
**Decision:** Phase 1 ships interfaces + mocks + ContactFact table; no LLM or Twilio/email sends.  
**Consequences:** AI Brief is factual/empty only; no fabricated summaries.

## ADR-006: Provenance enum for intelligence data

**Status:** Accepted  
**Decision:** Use `DataProvenance` where signals/imports appear.  
**Consequences:** UI can label trust levels; AI cannot silently overwrite verified fields without audit.

## ADR-007: No MLS until authorized

**Status:** Accepted  
**Decision:** `MlsProvider` mock only until brokerage/MLS credentials and agreements exist.  
**Consequences:** Properties are user-entered in Phase 1.
