import { NextResponse } from "next/server"
import { requireOrgContext } from "@/server/session"
import {
  definitionFromSearchParams,
  runReport,
  runToCsv,
} from "@/domain/reports/service"

export async function GET(request: Request) {
  const ctx = await requireOrgContext()
  const url = new URL(request.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })
  const { type, definition } = definitionFromSearchParams(params)
  const run = await runReport(ctx.organization.id, type, definition)
  const csv = runToCsv(run)
  const filename = `${type.toLowerCase()}-${run.range.from.toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
