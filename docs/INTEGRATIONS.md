# Integrations — Joe Real Estate OS

## Rule

Every external system has an interface + development mock. No fake production integrations. Never scrape protected systems.

## Adapter layout

```
src/providers/
  ai/
  email/
  sms/
  voice/
  mls/
  storage/
  esign/
```

Each package exports:

- TypeScript interface
- `Mock*Provider` for local/dev
- Factory that selects provider from env

## Credential matrix

| Integration | Phase needed | Credentials | Status |
|-------------|--------------|-------------|--------|
| PostgreSQL | 1 | `DATABASE_URL` | Required locally (Docker) |
| Better Auth secret | 1 | `BETTER_AUTH_SECRET` | Required |
| Resend email | 5–9 | `RESEND_API_KEY`, `EMAIL_FROM` | Live adapter + mock; campaigns (Phase 9) reuse after approval |
| Twilio SMS | 5–9 | Account SID, auth, from number | Live adapter + mock; STOP webhook; campaigns reuse |
| Twilio Voice | 5 | — | Mock only (thin) |
| Google / Microsoft Calendar | 5+ | OAuth | Deferred |
| OpenAI / Anthropic | 7–8 | `OPENAI_API_KEY`, optional `OPENAI_MODEL` | OpenAI Chat Completions live + mock fallback; Anthropic not wired |
| S3 / Supabase Storage | 10 docs | Keys / bucket | Adapter stub |
| DocuSign (or similar) | 10 | OAuth / API | Adapter stub |
| MLS RESO / IDX / VOW | 11 | Brokerage + MLS agreements | Adapter stub only |

## MLS / IDX

Must wait for authorized access. Supported conceptual feeds: RESO Web API, IDX, VOW. All MLS-derived data must be attributable and rule-compliant. **No unauthorized scraping.**

## Webhooks (future)

Signed webhooks with verification; rate limiting; idempotency keys.

## Import / export (future)

CSV with field mapping, preview, validation, and non-silent merge for uncertain duplicates.
