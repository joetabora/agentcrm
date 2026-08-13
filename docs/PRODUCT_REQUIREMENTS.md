# Product Requirements — Joe Real Estate OS

## Vision

Joe Real Estate OS is a production-quality real estate CRM and operating system for agents and teams. It stores people, properties, and deals — and answers **who to contact, why, when, what to say, and what to do next**.

North star: **best information → best recommendation → best next action.**

The CRM should work for the agent, not require the agent to constantly work inside the CRM.

## Product principles

1. Action over analytics theater — no fake charts or fabricated data.
2. Relationship intelligence is core, not a bolt-on.
3. AI distinguishes facts, calculations, inferences, and recommendations.
4. Multi-tenant from day one (Organization → Teams → Users).
5. Provider abstractions for every external system.
6. Compliance by design (TCPA, Fair Housing, MLS rules).
7. Incremental delivery — ship tested slices, not untested piles.

## Competitive context (functional reference only)

Inspired by publicly observable workflows in Follow Up Boss, Lofty, Rechat, BoldTrail, Cloze, Top Producer, and Fello. We do not copy proprietary code, assets, branding, or UI.

## Phase 1 MVP (in scope)

| Area | Capability |
|------|------------|
| Auth | Email/password signup & sign-in; session protection |
| Tenancy | Organization + membership on first signup |
| Contacts | List, create, edit, detail with timeline |
| Relationships | Contact-to-contact graph foundation |
| Properties | User-entered properties + contact associations |
| Leads / Pipeline | Opportunity-based buyer & seller pipelines (Kanban + list) |
| Tasks / Appointments | Due work linked to contacts/properties |
| Dashboard | Today, attention required, pipeline counts — real data only |
| Search | Global ILIKE search across core entities |
| Seed | Labeled `[SEED]` development data |

## Explicitly out of Phase 1

- Workflow automation engine execution
- Email / SMS / dialer providers (interfaces + mocks only)
- MLS / IDX live feeds
- Marketing campaigns
- Transaction checklists UI
- LLM assistant calls
- Lead scoring UI engine
- Reporting engine
- CSV import/export UI
- PWA / native mobile

## Long-term capability map

See [ROADMAP.md](./ROADMAP.md) for Phases 1–13 covering workflows, communications, property intelligence, AI actions, marketing, transactions, MLS, mobile, and analytics.

## Success criteria for Phase 1

1. An agent can sign up, land in their org, and manage contacts/opportunities/tasks.
2. Contact detail is usable on mobile and desktop.
3. Dashboard reflects real DB state with honest empty states.
4. Tenant isolation is enforced and tested.
5. Docs and schema support later AI/integration layers without rewrite.
