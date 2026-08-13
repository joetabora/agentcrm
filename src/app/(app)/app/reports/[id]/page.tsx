import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { requireOrgContext } from "@/server/session"
import { deleteSavedReportAction } from "@/app/actions"
import {
  definitionToSearchParams,
  getSavedReport,
  parseStoredDefinition,
  runReport,
} from "@/domain/reports/service"
import { REPORT_TYPES } from "@/domain/reports/types"
import { PageHeader } from "@/components/crm/shared"
import { ReportResultsTable, formatSummaryValue } from "@/components/reports/report-results-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const TYPE_LABEL: Record<(typeof REPORT_TYPES)[number], string> = {
  CONVERSION: "Conversion",
  RESPONSE_TIME: "Response time",
  GCI: "GCI",
  SOURCE_ROI: "Source yield / ROI",
}

export default async function SavedReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const saved = await getSavedReport(ctx.organization.id, ctx.user.id, id)
  if (!saved) notFound()

  const definition = parseStoredDefinition(saved.definition)
  const run = await runReport(ctx.organization.id, saved.type, definition)
  const query = definitionToSearchParams(saved.type, definition).toString()

  return (
    <div className="space-y-6">
      <PageHeader
        title={saved.name}
        description={`${TYPE_LABEL[saved.type]} · live run`}
        actions={
          <>
            <Link href={`/app/reports?${query}`} className="inline-flex h-8 items-center rounded-lg border px-3 text-sm">
              Edit filters
            </Link>
            <a
              href={`/app/reports/export?${query}`}
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
            >
              Download CSV
            </a>
            <form action={deleteSavedReportAction}>
              <input type="hidden" name="reportId" value={saved.id} />
              <Button type="submit" size="sm" variant="ghost">
                Delete
              </Button>
            </form>
          </>
        }
      />

      <p className="text-xs text-muted-foreground">
        {format(run.range.from, "MMM d, yyyy")} – {format(run.range.to, "MMM d, yyyy")}
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
    </div>
  )
}
