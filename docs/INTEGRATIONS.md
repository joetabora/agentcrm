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
| Resend / SendGrid / Gmail | 5 | API keys / OAuth | Adapter stub |
| Twilio SMS / Voice | 5 | Account SID, auth, numbers | Adapter stub |
| Google / Microsoft Calendar | 5+ | OAuth | Deferred |
| OpenAI / Anthropic | 7–8 | API keys | Adapter stub |
| S3 / Supabase Storage | 10 docs | Keys / bucket | Adapter stub |
| DocuSign (or similar) | 10 | OAuth / API | Adapter stub |
| MLS RESO / IDX / VOW | 11 | Brokerage + MLS agreements | Adapter stub only |

## MLS / IDX

Must wait for authorized access. Supported conceptual feeds: RESO Web API, IDX, VOW. All MLS-derived data must be attributable and rule-compliant. **No unauthorized scraping.**

## Webhooks (future)

Signed webhooks with verification; rate limiting; idempotency keys.

## Import / export (future)

CSV with field mapping, preview, validation, and non-silent merge for uncertain duplicates.
