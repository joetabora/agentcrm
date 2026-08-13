# Roadmap — Joe Real Estate OS

## Phase 1 — CRM foundation (done)

Auth, org tenancy, contacts (+ detail), properties, leads/pipeline, tasks, appointments, activity timeline, dashboard, search, seed, tests. Deployed to Vercel + Supabase.

## Phase 2 — Lead management + pipeline polish (done)

Saved views, bulk actions, routing rules UI, richer filters, assignment audit UX, pipeline stage config.

## Phase 3 — Tasks + daily agenda intelligence (done)

Prioritization heuristics (transparent), snooze/reschedule UX, recurring tasks.

## Phase 4 — Workflow automation (done)

Generic engine: trigger → conditions → actions → delays → branches → enrollment.

## Phase 5 — Communication integrations (done)

Email/SMS providers (Resend/Twilio + mocks), threads, consent/opt-out, templates.

## Phase 6 — Property intelligence (done)

Match engine, price/DOM signals (with provenance), buyer preference evaluation.

## Phase 7 — AI assistant (done)

Context-aware Q&A over authorized CRM data; facts vs inference labeling; no fabrication.

## Phase 8 — AI action engine (done)

Tool execution with permission checks, confirmation for high-risk actions, audit logs.

## Phase 9 — Marketing automation (done)

Campaigns, drips, merge variables, human approval before external send.

## Phase 10 — Transactions (done)

Offers, contracts, deadlines, checklists, parties, commission fields.

## Phase 11 — MLS / IDX (done)

Authorized RESO/IDX/VOW only. No scraping. Clear data attribution.

## Phase 12 — Mobile / PWA (done)

Installable PWA, offline-friendly agenda/contact basics, outbox for complete-task + add-note.

## Phase 13 — Advanced analytics (current)

Reusable reporting primitives: conversion, response time, GCI, source ROI.

## Dependency notes

- Phases 5–6 and 11 require external credentials / MLS authorization.
- Phases 7–8 require AI provider keys and hardened permission model.
- Do not run multiple late phases in parallel until Phase 1–3 foundations are solid.
