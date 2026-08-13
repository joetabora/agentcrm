import { endOfDay, startOfDay, startOfYear, subDays } from "date-fns"
import type { DatePreset, ReportDefinition, ResolvedRange } from "./types"

export function resolveReportRange(
  definition: Pick<ReportDefinition, "preset" | "from" | "to">,
  now = new Date(),
): ResolvedRange {
  const preset = definition.preset
  const to = endOfDay(now)

  if (preset === "custom") {
    const fromRaw = definition.from ? new Date(definition.from) : startOfDay(subDays(now, 30))
    const toRaw = definition.to ? new Date(definition.to) : to
    if (Number.isNaN(fromRaw.getTime()) || Number.isNaN(toRaw.getTime())) {
      throw new Error("Invalid custom date range")
    }
    const from = startOfDay(fromRaw)
    const end = endOfDay(toRaw)
    if (from.getTime() > end.getTime()) {
      throw new Error("Range start must be before end")
    }
    return { from, to: end, preset }
  }

  if (preset === "7d") return { from: startOfDay(subDays(now, 6)), to, preset }
  if (preset === "90d") return { from: startOfDay(subDays(now, 89)), to, preset }
  if (preset === "ytd") return { from: startOfYear(now), to, preset }
  return { from: startOfDay(subDays(now, 29)), to, preset: "30d" }
}
