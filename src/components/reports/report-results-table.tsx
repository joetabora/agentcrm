import type { ReportCell, ReportColumn, ReportRun } from "@/domain/reports/types"

function formatCell(key: string, value: ReportCell): string {
  if (value == null) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (
    typeof value === "number" &&
    (key.toLowerCase().includes("rate") ||
      key === "conversion" ||
      key === "share" ||
      key === "roi")
  ) {
    if (key === "share") return `${value}%`
    return `${Math.round(value * 1000) / 10}%`
  }
  if (
    typeof value === "number" &&
    (key.toLowerCase().includes("gci") ||
      key === "spend" ||
      key === "agentNet" ||
      key === "gciSum" ||
      key === "agentNetSum" ||
      key === "gciPerOpp")
  ) {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value)
  }
  return String(value)
}

export function formatSummaryValue(key: string, value: ReportCell): string {
  return formatCell(key, value)
}

export function ReportResultsTable({ run }: { run: ReportRun }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {run.columns.map((col: ReportColumn) => (
              <th key={col.key} className="px-3 py-2 text-left font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {run.rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-muted-foreground" colSpan={run.columns.length}>
                No rows in this range.
              </td>
            </tr>
          ) : (
            run.rows.map((row, i) => (
              <tr key={i} className="border-t">
                {run.columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 tabular-nums">
                    {formatCell(col.key, row[col.key] ?? null)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
