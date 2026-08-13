# AI Architecture — Joe Real Estate OS

## Goals

Joe Intelligence should eventually combine contact + conversation + property + activity + transaction + market signals into a **next best action** — without fabricating CRM facts.

## Provider abstraction

```
AIProvider
  ├── OpenAIProvider
  ├── AnthropicProvider
  └── MockAIProvider (development)
```

Application code never imports a vendor SDK directly outside `src/providers/ai`.

Model selection by task:

- Fast/cheap: classification, extraction, summarization
- Advanced: reasoning, complex planning

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

Phase 1: table exists; UI shows facts only. No LLM writes.

## Action system (future)

```
Intent → Permission check → Tool → Action → Audit log → Result
```

High-risk/external actions require confirmation by default.

Examples of future tools: create task, draft email, enroll workflow, match buyers.

## Phase 1 policy

- No LLM API calls.
- Contact detail “AI Brief” = structured placeholders + stored facts.
- MockAIProvider returns empty/safe stubs for tests.

## Fair Housing & safety

Property recommendations must not use protected characteristics or prohibited proxies. See [COMPLIANCE.md](./COMPLIANCE.md).
