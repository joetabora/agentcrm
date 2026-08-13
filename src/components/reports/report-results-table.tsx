import type { ReportCell, ReportColumn, ReportRun } from "@/domain/reports/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
    <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {run.columns.map((col: ReportColumn) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {run.rows.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={run.columns.length}>
                No rows in this range.
              </TableCell>
            </TableRow>
          ) : (
            run.rows.map((row, i) => (
              <TableRow key={i}>
                {run.columns.map((col) => (
                  <TableCell key={col.key} className="tabular-nums">
                    {formatCell(col.key, row[col.key] ?? null)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
