import { z } from "zod"
import { prisma } from "@/lib/db"
import type { OpportunityType, Prisma, ReportType } from "@/generated/prisma/client"
import { reportToCsv } from "./csv"
import { decimalToNumber, median, p90, rate, roundHours, sourceRoi } from "./math"
import { resolveReportRange } from "./range"
import {
  DATE_PRESETS,
  REPORT_TYPES,
  UNKNOWN_SOURCE,
  type DatePreset,
  type ReportDefinition,
  type ReportRun,
  type ResolvedRange,
} from "./types"

const OUTBOUND_TYPES = ["EMAIL", "SMS", "CALL"] as const

export const reportDefinitionSchema = z.object({
  preset: z.enum(DATE_PRESETS).default("30d"),
  from: z.string().optional(),
  to: z.string().optional(),
  opportunityType: z.enum(["BUYER", "SELLER"]).optional(),
  sourceSpend: z.record(z.string(), z.number().nonnegative()).optional(),
})

export const createSavedReportSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(REPORT_TYPES),
  definition: reportDefinitionSchema,
})

export type CreateSavedReportInput = z.infer<typeof createSavedReportSchema>

function oppWhere(
  organizationId: string,
  range: ResolvedRange,
  opportunityType?: OpportunityType,
): Prisma.OpportunityWhereInput {
  return {
    organizationId,
    createdAt: { gte: range.from, lte: range.to },
    ...(opportunityType ? { type: opportunityType } : {}),
  }
}

function resolveSource(input: {
  opportunitySource: string | null
  contactSource: string | null
  leadSource: string | null
}): string {
  const raw = input.opportunitySource || input.contactSource || input.leadSource
  const trimmed = raw?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : UNKNOWN_SOURCE
}

export async function runConversionReport(
  organizationId: string,
  range: ResolvedRange,
  opportunityType?: OpportunityType,
): Promise<ReportRun> {
  const opps = await prisma.opportunity.findMany({
    where: oppWhere(organizationId, range, opportunityType),
    select: {
      id: true,
      pipelineStage: { select: { key: true, name: true, position: true } },
    },
  })

  const byKey = new Map<string, { key: string; name: string; position: number; count: number }>()
  for (const opp of opps) {
    const key = opp.pipelineStage.key
    const existing = byKey.get(key)
    if (existing) {
      existing.count += 1
    } else {
      byKey.set(key, {
        key,
        name: opp.pipelineStage.name,
        position: opp.pipelineStage.position,
        count: 1,
      })
    }
  }

  const created = opps.length
  const closed = byKey.get("CLOSED")?.count ?? 0
  const lost = byKey.get("LOST")?.count ?? 0
  const rows = [...byKey.values()]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((row) => ({
      stage: row.name,
      key: row.key,
      count: row.count,
      share: created > 0 ? Math.round((row.count / created) * 1000) / 10 : null,
    }))

  return {
    type: "CONVERSION",
    range,
    summary: {
      created,
      closed,
      lost,
      closedRate: rate(closed, created),
      lostRate: rate(lost, created),
    },
    columns: [
      { key: "stage", label: "Stage" },
      { key: "key", label: "Key" },
      { key: "count", label: "Count" },
      { key: "share", label: "Share %" },
    ],
    rows,
    caveats: [
      "Counts use each opportunity's current stage (snapshot), not historical path-through.",
      "Closed % = stage key CLOSED / opportunities created in range. Lost % = LOST / created.",
    ],
  }
}

export async function runResponseTimeReport(
  organizationId: string,
  range: ResolvedRange,
  opportunityType?: OpportunityType,
): Promise<ReportRun> {
  const opps = await prisma.opportunity.findMany({
    where: oppWhere(organizationId, range, opportunityType),
    select: {
      id: true,
      title: true,
      createdAt: true,
      contactId: true,
    },
  })

  const hours: number[] = []
  const rows: ReportRun["rows"] = []
  let uncontacted = 0

  if (opps.length > 0) {
    const oppIds = opps.map((o) => o.id)
    const contactIds = [...new Set(opps.map((o) => o.contactId))]
    const activities = await prisma.activity.findMany({
      where: {
        organizationId,
        type: { in: [...OUTBOUND_TYPES] },
        actorUserId: { not: null },
        OR: [{ opportunityId: { in: oppIds } }, { contactId: { in: contactIds } }],
      },
      select: {
        opportunityId: true,
        contactId: true,
        occurredAt: true,
        type: true,
      },
      orderBy: { occurredAt: "asc" },
    })

    for (const opp of opps) {
      const first = activities.find((a) => {
        if (a.occurredAt.getTime() < opp.createdAt.getTime()) return false
        if (a.opportunityId === opp.id) return true
        return a.opportunityId == null && a.contactId === opp.contactId
      })
      if (!first) {
        uncontacted += 1
        rows.push({
          opportunityId: opp.id,
          title: opp.title,
          hoursToFirst: null,
          uncontacted: true,
        })
        continue
      }
      const h = (first.occurredAt.getTime() - opp.createdAt.getTime()) / 3_600_000
      hours.push(h)
      rows.push({
        opportunityId: opp.id,
        title: opp.title,
        hoursToFirst: roundHours(h),
        uncontacted: false,
      })
    }
  }

  rows.sort((a, b) => {
    const ah = typeof a.hoursToFirst === "number" ? a.hoursToFirst : Number.POSITIVE_INFINITY
    const bh = typeof b.hoursToFirst === "number" ? b.hoursToFirst : Number.POSITIVE_INFINITY
    return ah - bh
  })

  return {
    type: "RESPONSE_TIME",
    range,
    summary: {
      created: opps.length,
      contacted: hours.length,
      uncontacted,
      medianHours: median(hours) == null ? null : roundHours(median(hours)!),
      p90Hours: p90(hours) == null ? null : roundHours(p90(hours)!),
    },
    columns: [
      { key: "title", label: "Opportunity" },
      { key: "hoursToFirst", label: "Hours to first outbound" },
      { key: "uncontacted", label: "Uncontacted" },
    ],
    rows,
    caveats: [
      "First response is the first outbound EMAIL, SMS, or CALL activity after the opportunity was created.",
      "Uncontacted opportunities are not treated as zero minutes.",
      "Opportunity.firstContactAt is set on create and is not used.",
    ],
  }
}

function transactionInRange(
  closingDate: Date | null,
  createdAt: Date,
  range: ResolvedRange,
): { inRange: boolean; usedCreatedAt: boolean; effectiveDate: Date } {
  if (closingDate) {
    return {
      inRange: closingDate >= range.from && closingDate <= range.to,
      usedCreatedAt: false,
      effectiveDate: closingDate,
    }
  }
  return {
    inRange: createdAt >= range.from && createdAt <= range.to,
    usedCreatedAt: true,
    effectiveDate: createdAt,
  }
}

export async function runGciReport(
  organizationId: string,
  range: ResolvedRange,
  opportunityType?: OpportunityType,
): Promise<ReportRun> {
  const txs = await prisma.transaction.findMany({
    where: {
      organizationId,
      status: "CLOSED",
      ...(opportunityType ? { opportunity: { type: opportunityType } } : {}),
    },
    select: {
      id: true,
      title: true,
      gciAmount: true,
      agentSplitPercent: true,
      closingDate: true,
      createdAt: true,
      opportunity: { select: { type: true, title: true } },
    },
  })

  const rows: ReportRun["rows"] = []
  let gciSum = 0
  let agentNetSum = 0
  let missingGci = 0
  let usedCreatedAtCount = 0

  for (const tx of txs) {
    const { inRange, usedCreatedAt, effectiveDate } = transactionInRange(
      tx.closingDate,
      tx.createdAt,
      range,
    )
    if (!inRange) continue
    if (usedCreatedAt) usedCreatedAtCount += 1
    const gci = decimalToNumber(tx.gciAmount)
    const split = decimalToNumber(tx.agentSplitPercent)
    const agentNet = gci != null && split != null ? (gci * split) / 100 : null
    if (gci == null) missingGci += 1
    else gciSum += gci
    if (agentNet != null) agentNetSum += agentNet
    rows.push({
      title: tx.title,
      opportunityType: tx.opportunity.type,
      gci,
      agentNet,
      usedCreatedAt,
      effectiveDate: effectiveDate.toISOString().slice(0, 10),
    })
  }

  return {
    type: "GCI",
    range,
    summary: {
      closedCount: rows.length,
      gciSum,
      agentNetSum,
      missingGci,
      usedCreatedAtCount,
    },
    columns: [
      { key: "title", label: "Transaction" },
      { key: "opportunityType", label: "Side" },
      { key: "effectiveDate", label: "Date" },
      { key: "gci", label: "GCI" },
      { key: "agentNet", label: "Agent net" },
      { key: "usedCreatedAt", label: "Used created date" },
    ],
    rows,
    caveats: [
      "Only CLOSED transactions. GCI is never inferred from opportunity estimated value.",
      "If closingDate is empty, createdAt is used and the row is flagged.",
      "Agent net = GCI × agent split % only when both values are set.",
    ],
  }
}

export async function runSourceRoiReport(
  organizationId: string,
  range: ResolvedRange,
  opportunityType?: OpportunityType,
  sourceSpend?: Record<string, number>,
): Promise<ReportRun> {
  const opps = await prisma.opportunity.findMany({
    where: oppWhere(organizationId, range, opportunityType),
    select: {
      id: true,
      source: true,
      pipelineStage: { select: { key: true } },
      contact: { select: { source: true, leadSource: true } },
      transaction: {
        select: {
          status: true,
          gciAmount: true,
        },
      },
    },
  })

  const buckets = new Map<
    string,
    { created: number; closed: number; gci: number }
  >()

  for (const opp of opps) {
    const source = resolveSource({
      opportunitySource: opp.source,
      contactSource: opp.contact.source,
      leadSource: opp.contact.leadSource,
    })
    const bucket = buckets.get(source) ?? { created: 0, closed: 0, gci: 0 }
    bucket.created += 1
    const isClosed = opp.pipelineStage.key === "CLOSED"
    if (isClosed) bucket.closed += 1
    if (opp.transaction?.status === "CLOSED") {
      const gci = decimalToNumber(opp.transaction.gciAmount)
      if (gci != null) bucket.gci += gci
    }
    buckets.set(source, bucket)
  }

  const spend = sourceSpend ?? {}
  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].created - a[1].created || a[0].localeCompare(b[0]))
    .map(([source, b]) => {
      const spendAmount = spend[source]
      const conversion = rate(b.closed, b.created)
      const gciPerOpp = rate(b.gci, b.created)
      return {
        source,
        created: b.created,
        closed: b.closed,
        conversion,
        gci: b.gci,
        gciPerOpp,
        spend: spendAmount ?? null,
        roi: sourceRoi(b.gci, spendAmount),
      }
    })

  const created = opps.length
  const closed = rows.reduce((n, r) => n + Number(r.closed), 0)
  const gci = rows.reduce((n, r) => n + Number(r.gci), 0)
  const anySpend = rows.some((r) => r.spend != null)

  return {
    type: "SOURCE_ROI",
    range,
    summary: {
      created,
      closed,
      gci,
      sources: rows.length,
      roiComputed: anySpend,
    },
    columns: [
      { key: "source", label: "Source" },
      { key: "created", label: "Opportunities" },
      { key: "closed", label: "Closed" },
      { key: "conversion", label: "Conversion" },
      { key: "gci", label: "Closed GCI" },
      { key: "gciPerOpp", label: "GCI / opp" },
      { key: "spend", label: "Spend" },
      { key: "roi", label: "ROI (GCI / spend)" },
    ],
    rows,
    caveats: [
      "Source is Opportunity.source, else Contact.source, else Contact.leadSource, else (none).",
      "Closed count uses current stage key CLOSED. GCI is from a linked CLOSED transaction only.",
      "ROI is GCI / spend and is blank unless spend is entered for that source. This is yield, not marketing ROI, when spend is missing.",
    ],
  }
}

export async function runReport(
  organizationId: string,
  type: ReportType,
  definition: ReportDefinition,
  now = new Date(),
): Promise<ReportRun> {
  const parsed = reportDefinitionSchema.parse(definition)
  const range = resolveReportRange(parsed, now)
  if (type === "CONVERSION") {
    return runConversionReport(organizationId, range, parsed.opportunityType)
  }
  if (type === "RESPONSE_TIME") {
    return runResponseTimeReport(organizationId, range, parsed.opportunityType)
  }
  if (type === "GCI") {
    return runGciReport(organizationId, range, parsed.opportunityType)
  }
  return runSourceRoiReport(
    organizationId,
    range,
    parsed.opportunityType,
    parsed.sourceSpend,
  )
}

export function runToCsv(run: ReportRun): string {
  return reportToCsv(run.columns, run.rows)
}

export async function listSavedReports(organizationId: string, userId: string) {
  return prisma.savedReport.findMany({
    where: { organizationId, ownerUserId: userId },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getSavedReport(
  organizationId: string,
  userId: string,
  reportId: string,
) {
  return prisma.savedReport.findFirst({
    where: { id: reportId, organizationId, ownerUserId: userId },
  })
}

export async function createSavedReport(
  organizationId: string,
  ownerUserId: string,
  input: CreateSavedReportInput,
) {
  const data = createSavedReportSchema.parse(input)
  return prisma.savedReport.create({
    data: {
      organizationId,
      ownerUserId,
      name: data.name,
      type: data.type,
      definition: data.definition as Prisma.InputJsonValue,
    },
  })
}

export async function deleteSavedReport(
  organizationId: string,
  userId: string,
  reportId: string,
) {
  const report = await prisma.savedReport.findFirst({
    where: { id: reportId, organizationId, ownerUserId: userId },
  })
  if (!report) return null
  await prisma.savedReport.delete({ where: { id: report.id } })
  return report
}

export function parseReportType(raw: string | undefined): ReportType {
  if (raw && (REPORT_TYPES as readonly string[]).includes(raw)) return raw as ReportType
  return "CONVERSION"
}

export function parseDatePreset(raw: string | undefined): DatePreset {
  if (raw && (DATE_PRESETS as readonly string[]).includes(raw)) return raw as DatePreset
  return "30d"
}

export function parseOpportunityTypeFilter(
  raw: string | undefined,
): OpportunityType | undefined {
  if (raw === "BUYER" || raw === "SELLER") return raw
  return undefined
}

export function parseSourceSpend(params: Record<string, string | string[] | undefined>) {
  const spend: Record<string, number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith("spend:")) continue
    const source = key.slice("spend:".length)
    const raw = Array.isArray(value) ? value[0] : value
    if (!raw) continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) continue
    spend[source] = n
  }
  return Object.keys(spend).length ? spend : undefined
}

export function definitionToSearchParams(
  type: ReportType,
  definition: ReportDefinition,
): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("type", type)
  sp.set("preset", definition.preset)
  if (definition.from) sp.set("from", definition.from)
  if (definition.to) sp.set("to", definition.to)
  if (definition.opportunityType) sp.set("opportunityType", definition.opportunityType)
  if (definition.sourceSpend) {
    for (const [source, amount] of Object.entries(definition.sourceSpend)) {
      sp.set(`spend:${source}`, String(amount))
    }
  }
  return sp
}

export function parseStoredDefinition(raw: unknown): ReportDefinition {
  const parsed = reportDefinitionSchema.safeParse(raw)
  if (!parsed.success) {
    return { preset: "30d" }
  }
  return parsed.data
}

export function definitionFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): { type: ReportType; definition: ReportDefinition } {
  const one = (k: string) => {
    const v = params[k]
    return Array.isArray(v) ? v[0] : v
  }
  const type = parseReportType(one("type"))
  const preset = parseDatePreset(one("preset"))
  const definition: ReportDefinition = {
    preset,
    from: one("from") || undefined,
    to: one("to") || undefined,
    opportunityType: parseOpportunityTypeFilter(one("opportunityType")),
    sourceSpend: parseSourceSpend(params),
  }
  return { type, definition }
}
