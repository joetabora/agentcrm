# Phase 12 — Mobile / PWA checklist

Service worker generation uses webpack (`npm run build` / `npm run dev:pwa`). Default `next dev` (Turbopack) leaves the SW disabled.

Manual verification after deploy (HTTPS required for install):

1. **Install**
   - Open the production site on a phone browser.
   - Add to Home Screen / Install app.
   - Confirm standalone launch opens `/app`.

2. **Online stash**
   - While online, open Dashboard (agenda), Contacts list, and a contact detail.
   - Confirm no offline banner.

3. **Offline read**
   - Enable airplane mode.
   - Confirm amber offline banner.
   - Revisit Dashboard / Contacts / that contact — cached data shows with stale badge when IndexedDB stash exists.

4. **Offline writes**
   - Offline: tap **Done** on a task → toast “Queued”; agenda removes that task from stash.
   - Offline: add a contact note → “Queue note”; appears as queued in timeline stash.
   - Confirm snooze / email / SMS controls are disabled or hidden offline.

5. **Sync**
   - Re-enable network.
   - Sync queue indicator drains (or tap Sync now).
   - Task shows completed; note appears on contact after refresh.

6. **Out of scope (must not queue)**
   - Email, SMS, stage moves, campaigns, MLS, transactions — not available offline.
