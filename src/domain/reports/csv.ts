import type { ReportCell, ReportColumn } from "./types"

function escapeCsvField(value: ReportCell): string {
  if (value == null) return ""
  const raw = typeof value === "boolean" ? (value ? "true" : "false") : String(value)
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`
  }
  return raw
}

export function reportToCsv(
  columns: ReportColumn[],
  rows: Array<Record<string, ReportCell>>,
): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",")
  const body = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key] ?? null)).join(","))
  return [header, ...body].join("\r\n") + (body.length ? "\r\n" : "")
}
