# Compliance — Joe Real Estate OS

## Principles

The product must never encourage or automate illegal solicitation, spam, TCPA/DNC violations, unauthorized MLS access, Fair Housing violations, unauthorized PII disclosure, false advertising, or fabricated property data.

## Communications (TCPA / consent)

- Store consent and opt-out status on contacts (and channels when added).
- SMS/email/voice sends (Phase 5+) must check consent before provider calls.
- Opt-out is honored immediately and audited.
- Do not build systems designed to circumvent carrier or regulatory requirements.

## Do-not-contact

Contact-level `doNotContact` blocks outbound automation and warns on manual send UIs.

## Fair Housing

Property and neighborhood recommendations must use legitimate housing criteria only (price, beds, baths, location preferences stated by the buyer, property features).

Prohibited: race, religion, familial status, disability, national origin, sex, or proxies intended to discriminate.

AI tools that match buyers to properties must enforce this in prompt constraints and post-filters.

## MLS / listing data

Only authorized feeds. Attribute source. Respect display and storage rules. Never invent MLS fields.

## Marketing content

AI-generated marketing is a **draft** until human approval for external publication (default).

## Data accuracy

- Never fabricate email/SMS/call history.
- Never present AI inference as verified fact.
- Distinguish USER_ENTERED / IMPORTED / VERIFIED / CALCULATED / AI_INFERENCE.

## Privacy

Tenant isolation is mandatory. Export/delete capabilities will be added as the product commercializes.
