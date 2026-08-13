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

Application code never imports a vendor SDK directly outside `src/providers/ai`. Phase 7 uses the documented OpenAI Chat Completions HTTP API (`POST /v1/chat/completions`).

Env:

- `OPENAI_API_KEY` — enables live answers
- `OPENAI_MODEL` — default `gpt-4o-mini`

Model selection by task:

- Fast/cheap: classification, extraction, Q&A (Phase 7)
- Advanced: reasoning, complex planning (later)

## Phase 7 — grounded assistant

Flow:

1. `requireOrgContext`
2. `buildCrmContext` — org-scoped snippets (contact, facts, prefs, opportunities, tasks, activities, properties, keyword search hits)
3. Refuse if context pack is empty
4. `AIProvider.complete` with system prompt requiring FACT / CALCULATION / INFERENCE / UNKNOWN labels
5. Zod-parse JSON response; on failure → safe refuse
6. `AuditLog` with `source: AI`, `entityType: AssistantQuery`

UI: `/app/assistant` (+ `?contactId=` deep link). **No tool calling / CRM mutations by the model** (Phase 8). Optional “Save as ContactFact” is a separate human-confirmed write (`source: AI`, `provenance: AI_INFERENCE`).

## Fact vs inference

| Kind | Meaning | Storage |
|------|---------|---------|
| Fact | Observed or user-confirmed | ContactFact / CRM fields |
| Calculation | Deterministic from data | Computed at read time |
| Inference | Model guess | Labeled AI_INFERENCE; low trust until verified |
| Recommendation | Suggested action | Ephemeral or audited suggestion record |

Never present estimates or inferences as verified facts.

## Contact memory (`ContactFact`)

Structured facts:

- statement (e.g. "Prefers ranch homes")
- source (conversation, user, import, AI)
- confidence
- createdAt / lastVerifiedAt

Phase 7: LLM never auto-writes facts. Contact detail “AI Brief” stays deterministic; Assistant handles Q&A.

## Action system (Phase 8+)

```
Intent → Permission check → Tool → Action → Audit log → Result
```

High-risk/external actions require confirmation by default.

Examples of future tools: create task, draft email, enroll workflow, match buyers.

## Fair Housing & safety

Property recommendations must not use protected characteristics or prohibited proxies. Assistant system prompt forbids protected-class reasoning; property answers stick to stored inventory fields only. See [COMPLIANCE.md](./COMPLIANCE.md).
