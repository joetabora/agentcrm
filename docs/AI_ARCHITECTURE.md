# AI Architecture — Joe Real Estate OS

## Goals

Joe Intelligence should eventually combine contact + conversation + property + activity + transaction + market signals into a **next best action** — without fabricating CRM facts.

## Provider abstraction

```
AIProvider
  ├── OpenAIProvider   (OPENAI_API_KEY set)
  ├── AnthropicProvider (not wired yet)
  └── MockAIProvider   (default when no key)
```

Application code never imports a vendor SDK directly outside `src/providers/ai`. Phase 7–8 use the documented OpenAI Chat Completions HTTP API (`POST /v1/chat/completions`).

Env:

- `OPENAI_API_KEY` — enables live answers / action proposals
- `OPENAI_MODEL` — default `gpt-4o-mini`

## Phase 7 — grounded assistant

Flow:

1. `requireOrgContext`
2. `buildCrmContext` — org-scoped snippets
3. Refuse if context pack is empty
4. `AIProvider.complete` with FACT / CALCULATION / INFERENCE / UNKNOWN labels
5. Zod-parse JSON; on failure → safe refuse
6. `AuditLog` with `source: AI`, `entityType: AssistantQuery`

UI: `/app/assistant` (+ `?contactId=`).

## Phase 8 — action engine

```
Intent → Propose (LLM JSON) → Human confirm → Permission → Tool → Domain service → Audit → Result
```

- Model may return `proposedActions[]`; **never auto-executes**
- All tools require Confirm in the UI
- Registry: [`src/domain/ai/tools.ts`](../src/domain/ai/tools.ts)
- Execute: [`src/domain/ai/execute.ts`](../src/domain/ai/execute.ts)

Tools: `create_task`, `add_note`, `save_contact_fact`, `move_opportunity_stage`, `enroll_workflow`, `send_email`, `send_sms`.

Roles: `OWNER` / `ADMIN` / `AGENT` may confirm all; `ASSISTANT` only task / note / fact.

Email/SMS reuse Phase 5 consent/DNC checks. Audit: `entityType: AssistantAction`, actions `CONFIRM_EXECUTE` | `CONFIRM_DENIED`.

Mock provider returns empty `proposedActions`.

## Fact vs inference

| Kind | Meaning | Storage |
|------|---------|---------|
| Fact | Observed or user-confirmed | ContactFact / CRM fields |
| Calculation | Deterministic from data | Computed at read time |
| Inference | Model guess | Labeled AI_INFERENCE; low trust until verified |
| Recommendation | Suggested action | Proposed action until confirmed |

Never present estimates or inferences as verified facts. Never present proposals as completed work.

## Fair Housing & safety

Property recommendations must not use protected characteristics or prohibited proxies. See [COMPLIANCE.md](./COMPLIANCE.md).
