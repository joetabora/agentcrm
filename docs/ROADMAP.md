# Roadmap — Joe Real Estate OS

## Phase 1 — CRM foundation (done)

Auth, org tenancy, contacts (+ detail), properties, leads/pipeline, tasks, appointments, activity timeline, dashboard, search, seed, tests. Deployed to Vercel + Supabase.

## Phase 2 — Lead management + pipeline polish (done)

Saved views, bulk actions, routing rules UI, richer filters, assignment audit UX, pipeline stage config.

## Phase 3 — Tasks + daily agenda intelligence (done)

Prioritization heuristics (transparent), snooze/reschedule UX, recurring tasks.

## Phase 4 — Workflow automation (current)

Generic engine: trigger → conditions → actions → delays → branches → enrollment.

## Phase 5 — Communication integrations

Email/SMS/voice providers (real credentials), threads, consent/opt-out enforcement, templates.

## Phase 6 — Property intelligence

Match engine, price/DOM signals (with provenance), buyer preference evaluation.

## Phase 7 — AI assistant

Context-aware Q&A over authorized CRM data; facts vs inference labeling; no fabrication.

## Phase 8 — AI action engine

Tool execution with permission checks, confirmation for high-risk actions, audit logs.

## Phase 9 — Marketing automation

Campaigns, drips, merge variables, human approval before external send.

## Phase 10 — Transactions

Offers, contracts, deadlines, checklists, parties, commission fields.

## Phase 11 — MLS / IDX

Authorized RESO/IDX/VOW only. No scraping. Clear data attribution.

## Phase 12 — Mobile / PWA

Installable PWA, offline-friendly agenda/contact basics.

## Phase 13 — Advanced analytics

Reusable reporting primitives: conversion, response time, GCI, source ROI.

## Dependency notes

- Phases 5–6 and 11 require external credentials / MLS authorization.
- Phases 7–8 require AI provider keys and hardened permission model.
- Do not run multiple late phases in parallel until Phase 1–3 foundations are solid.
