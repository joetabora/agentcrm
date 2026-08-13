import type { OpportunityType, ReportType } from "@/generated/prisma/client"

export const REPORT_TYPES = [
  "CONVERSION",
  "RESPONSE_TIME",
  "GCI",
  "SOURCE_ROI",
] as const satisfies readonly ReportType[]

export const DATE_PRESETS = ["7d", "30d", "90d", "ytd", "custom"] as const

export type DatePreset = (typeof DATE_PRESETS)[number]

export type ReportDefinition = {
  preset: DatePreset
  from?: string
  to?: string
  opportunityType?: OpportunityType
  sourceSpend?: Record<string, number>
}

export type ResolvedRange = {
  from: Date
  to: Date
  preset: DatePreset
}

export type ReportColumn = {
  key: string
  label: string
}

export type ReportCell = string | number | null | boolean

export type ReportRun = {
  type: ReportType
  range: ResolvedRange
  summary: Record<string, ReportCell>
  columns: ReportColumn[]
  rows: Array<Record<string, ReportCell>>
  caveats: string[]
}

export const UNKNOWN_SOURCE = "(none)"
