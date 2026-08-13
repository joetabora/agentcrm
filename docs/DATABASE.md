# Database — Joe Real Estate OS

## Principles

1. Multi-tenant: every CRM row has `organizationId`.
2. Contact ≠ Opportunity — people and deals are separate.
3. Provenance for intelligence-related fields where applicable.
4. Safe migrations only — never destroy production data for convenience.
5. Better Auth owns identity tables; we own CRM tenancy tables.

## Core entities

### Tenancy

| Model | Purpose |
|-------|---------|
| Organization | Tenant root |
| Team | Optional grouping within org |
| Membership | User ↔ Org with role |

### Identity (Better Auth)

`User`, `Session`, `Account`, `Verification` — generated/maintained per Better Auth + Prisma adapter. Do not invent alternate session stores.

### People

| Model | Purpose |
|-------|---------|
| Contact | Person profile |
| ContactEmail / ContactPhone / ContactAddress | Normalized channels & address |
| ContactRelationship | Directed graph edges (spouse_of, referred_by, …) |
| Tag / ContactTag | Flexible labeling |
| ContactFact | Structured AI/human memory (source, confidence) |

### Deals

| Model | Purpose |
|-------|---------|
| Pipeline | Buyer / Seller (or custom) |
| PipelineStage | Ordered, configurable stages |
| Opportunity | Lead/deal record with source, scores, temperature, assignment |

### Real estate

| Model | Purpose |
|-------|---------|
| Property | Address + characteristics + listing fields; optional MLS attribution (`mlsSource`, `mlsListingKey`, `mlsAttribution`, `mlsLastSyncedAt`) |
| ContactProperty | M:N with role (owner, buyer_interest, listing_client, …) |

### Work & history

| Model | Purpose |
|-------|---------|
| Activity | Chronological timeline (calls, notes, status changes, …) |
| Task | Actionable work items |
| Appointment | Scheduled meetings |

### Automation stubs

| Model | Purpose |
|-------|---------|
| Workflow | Definition placeholder |
| WorkflowEnrollment | Contact/opportunity enrollment placeholder |

### Governance

| Model | Purpose |
|-------|---------|
| AuditLog | Who changed what (before/after, source) |
| AssignmentEvent | Lead/opportunity assignment audit trail |

## Lead vs Opportunity

“Lead” is a product concept. Persistence is `Opportunity` with:

- `type`: BUYER | SELLER
- `temperature`, `source`, `campaign`
- `engagementScore`, `leadScore` (nullable until scoring engine)
- `pipelineStageId`, `assignedToUserId`
- consent / do-not-contact flags on Contact (and channel-level where needed)

## Default pipeline stages

Shared lifecycle for seed Buyer and Seller pipelines:

`NEW → CONTACTED → ENGAGED → QUALIFIED → APPOINTMENT → ACTIVE_CLIENT → UNDER_CONTRACT → CLOSED → PAST_CLIENT → NURTURE` (+ `LOST` as terminal).

## Provenance

Where data quality matters (esp. properties / signals), prefer:

`USER_ENTERED | IMPORTED | VERIFIED | CALCULATED | AI_INFERENCE`

Phase 1 properties are primarily `USER_ENTERED`.

## Indexes (initial)

- `(organizationId, …)` on all tenant tables for list filters
- Contact name / email / phone for search & dedupe later
- Opportunity `(organizationId, pipelineStageId)`, `(organizationId, assignedToUserId)`
- Activity `(organizationId, contactId, occurredAt)`
- Task `(organizationId, dueAt, status)`

## Seed data

Development seed is labeled `[SEED]` in names/notes and never runs in production paths.
