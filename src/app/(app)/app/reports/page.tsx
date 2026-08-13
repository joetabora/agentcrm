import Link from "next/link"
import { format } from "date-fns"
import { requireOrgContext } from "@/server/session"
import {
  createSavedReportAction,
  deleteSavedReportAction,
} from "@/app/actions"
import {
  definitionFromSearchParams,
  definitionToSearchParams,
  listSavedReports,
  runReport,
} from "@/domain/reports/service"
import { DATE_PRESETS, REPORT_TYPES } from "@/domain/reports/types"
import { PageHeader } from "@/components/crm/shared"
import { ReportResultsTable, formatSummaryValue } from "@/components/reports/report-results-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const TYPE_LABEL: Record<(typeof REPORT_TYPES)[number], string> = {
  CONVERSION: "Conversion",
  RESPONSE_TIME: "Response time",
  GCI: "GCI",
  SOURCE_ROI: "Source yield / ROI",
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const { type, definition } = definitionFromSearchParams(params)
  const run = await runReport(ctx.organization.id, type, definition)
  const saved = await listSavedReports(ctx.organization.id, ctx.user.id)
  const query = definitionToSearchParams(type, definition).toString()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Live queries over CRM data — conversion, first response, closed GCI, and source yield. No fabricated metrics."
        actions={
          <a
            href={`/app/reports/export?${query}`}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
          >
            Download CSV
          </a>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Report</span>
          <select name="type" defaultValue={type} className="h-8 rounded-lg border bg-background px-2 text-sm">
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Range</span>
          <select
            name="preset"
            defaultValue={definition.preset}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">From (custom)</span>
          <Input name="from" type="date" defaultValue={definition.from} className="h-8" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">To (custom)</span>
          <Input name="to" type="date" defaultValue={definition.to} className="h-8" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Pipeline</span>
          <select
            name="opportunityType"
            defaultValue={definition.opportunityType ?? ""}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">All</option>
            <option value="BUYER">Buyer</option>
            <option value="SELLER">Seller</option>
          </select>
        </label>
        {definition.sourceSpend
          ? Object.entries(definition.sourceSpend).map(([source, amount]) => (
              <input key={source} type="hidden" name={`spend:${source}`} value={amount} />
            ))
          : null}
        <Button type="submit" size="sm">
          Run
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        {format(run.range.from, "MMM d, yyyy")} – {format(run.range.to, "MMM d, yyyy")} ·{" "}
        {TYPE_LABEL[run.type]}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(run.summary).map(([key, value]) => (
          <Card key={key}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {key}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold tabular-nums">
              {formatSummaryValue(key, value)}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {run.caveats.map((c) => (
          <p key={c} className="text-xs text-muted-foreground">
            {c}
          </p>
        ))}
      </div>

      <ReportResultsTable run={run} />

      {type === "SOURCE_ROI" && run.rows.length > 0 ? (
        <form method="get" className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Source spend (optional)</p>
          <p className="text-xs text-muted-foreground">
            ROI = closed GCI / spend. Leave blank to show yield only.
          </p>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="preset" value={definition.preset} />
          {definition.from ? <input type="hidden" name="from" value={definition.from} /> : null}
          {definition.to ? <input type="hidden" name="to" value={definition.to} /> : null}
          {definition.opportunityType ? (
            <input type="hidden" name="opportunityType" value={definition.opportunityType} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {run.rows.map((row) => {
              const source = String(row.source ?? "")
              return (
                <label key={source} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{source}</span>
                  <Input
                    name={`spend:${source}`}
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={
                      definition.sourceSpend?.[source] != null
                        ? String(definition.sourceSpend[source])
                        : ""
                    }
                    className="h-8 w-28"
                    placeholder="USD"
                  />
                </label>
              )
            })}
          </div>
          <Button type="submit" size="sm" variant="outline">
            Recalculate ROI
          </Button>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={createSavedReportAction} className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Save this query</p>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="definitionJson" value={JSON.stringify(definition)} />
          <Input name="name" required maxLength={120} placeholder="Name" className="h-8" />
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-medium">Saved reports</p>
          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-2">
              {saved.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <Link href={`/app/reports/${r.id}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                    {r.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{TYPE_LABEL[r.type]}</Badge>
                    <form action={deleteSavedReportAction}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
