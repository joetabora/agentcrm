# Reports

Live, org-scoped queries. Results are computed from Postgres on each run — nothing is fabricated.

Open **Reports** (`/app/reports`). Pick a type and date range, optionally filter Buyer/Seller, then download CSV or save the query.

## Types

| Type | Numerator / measure | Caveat |
|------|---------------------|--------|
| Conversion | Opportunities **created in range**, counted by **current** pipeline stage. Closed % = `CLOSED` / created. Lost % = `LOST` / created. | Snapshot, not historical path-through. |
| Response time | Hours from `opportunity.createdAt` to first outbound `EMAIL`, `SMS`, or `CALL` activity. Median and p90 among contacted. | Uncontacted is not zero minutes. `firstContactAt` is unused (set on create). |
| GCI | `Transaction.gciAmount` where `status = CLOSED` and `closingDate` in range. | If `closingDate` is empty, `createdAt` is used and the row is flagged. Never derived from estimated value. Agent net = GCI × split % when both are set. |
| Source yield / ROI | Per source: opps created, closed (current `CLOSED` stage), GCI from a linked closed transaction. | Source = opportunity.source, else contact.source, else leadSource. **ROI = GCI / spend** only when you enter spend; otherwise the ROI column is blank (yield, not marketing ROI). |

Date presets: `7d`, `30d`, `90d`, `ytd`, `custom`. CSV is UTF-8 with RFC 4180 quoting.
