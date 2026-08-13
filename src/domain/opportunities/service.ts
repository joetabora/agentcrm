import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type {
  AuditSource,
  LeadTemperature,
  Prisma,
} from "@/generated/prisma/client"
import { z } from "zod"
import { resolveRoutingAssignee } from "@/domain/routing/service"
import { subDays } from "date-fns"

export const createOpportunitySchema = z.object({
  contactId: z.string().min(1),
  type: z.enum(["BUYER", "SELLER"]),
  title: z.string().min(1).max(200),
  source: z.string().max(200).optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
  temperature: z.enum(["COLD", "WARM", "HOT"]).default("WARM"),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  nextAction: z.string().max(500).optional().nullable(),
  pipelineStageKey: z.string().optional(),
  propertyId: z.string().optional().nullable(),
})

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>

export const opportunityFiltersSchema = z.object({
  type: z.enum(["BUYER", "SELLER"]).optional(),
  stageKey: z.string().optional(),
  temperature: z.enum(["COLD", "WARM", "HOT"]).optional(),
  pipelineId: z.string().optional(),
  source: z.string().optional(),
  assignee: z.enum(["me", "unassigned"]).or(z.string()).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  lastContactFrom: z.string().optional(),
  lastContactTo: z.string().optional(),
  uncontacted: z.union([z.literal("1"), z.literal("true"), z.boolean()]).optional(),
  inactiveDays: z.coerce.number().int().positive().optional(),
  openOnly: z.union([z.literal("1"), z.literal("true"), z.boolean()]).optional(),
  q: z.string().optional(),
})

export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>

function truthy(v: unknown): boolean {
  return v === true || v === "1" || v === "true"
}

export function buildOpportunityWhere(
  organizationId: string,
  filters: OpportunityFilters | undefined,
  currentUserId?: string,
): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = { organizationId }
  if (!filters) return where

  if (filters.type) where.type = filters.type
  if (filters.temperature) where.temperature = filters.temperature
  if (filters.pipelineId) where.pipelineId = filters.pipelineId
  if (filters.stageKey) where.pipelineStage = { key: filters.stageKey }
  if (filters.source?.trim()) {
    where.source = { contains: filters.source.trim(), mode: "insensitive" }
  }

  if (filters.assignee === "me" && currentUserId) {
    where.assignedToUserId = currentUserId
  } else if (filters.assignee === "unassigned") {
    where.assignedToUserId = null
  } else if (filters.assignee) {
    where.assignedToUserId = filters.assignee
  }

  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {}
    if (filters.createdFrom) where.createdAt.gte = new Date(filters.createdFrom)
    if (filters.createdTo) where.createdAt.lte = new Date(filters.createdTo)
  }

  if (filters.lastContactFrom || filters.lastContactTo) {
    where.lastContactAt = {}
    if (filters.lastContactFrom) where.lastContactAt.gte = new Date(filters.lastContactFrom)
    if (filters.lastContactTo) where.lastContactAt.lte = new Date(filters.lastContactTo)
  }

  if (truthy(filters.uncontacted)) {
    where.OR = [{ lastContactAt: null }, { firstContactAt: null }]
  }

  if (filters.inactiveDays) {
    const cutoff = subDays(new Date(), filters.inactiveDays)
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [{ lastContactAt: { lt: cutoff } }, { lastContactAt: null, createdAt: { lt: cutoff } }],
      },
    ]
  }

  if (truthy(filters.openOnly)) {
    where.pipelineStage = {
      ...(filters.stageKey ? { key: filters.stageKey } : {}),
      isTerminal: false,
    }
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim()
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { source: { contains: q, mode: "insensitive" } },
          { contact: { firstName: { contains: q, mode: "insensitive" } } },
          { contact: { lastName: { contains: q, mode: "insensitive" } } },
        ],
      },
    ]
  }

  return where
}

export async function listOpportunities(
  organizationId: string,
  filters?: OpportunityFilters,
  currentUserId?: string,
) {
  const where = buildOpportunityWhere(organizationId, filters, currentUserId)

  return prisma.opportunity.findMany({
    where,
    include: {
      contact: { include: { emails: true, phones: true } },
      pipeline: true,
      pipelineStage: true,
      property: true,
      assignedTo: true,
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getOpportunity(organizationId: string, opportunityId: string) {
  return prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
    include: {
      contact: { include: { emails: true, phones: true } },
      pipeline: { include: { stages: { orderBy: { position: "asc" } } } },
      pipelineStage: true,
      property: true,
      assignedTo: true,
      assignmentEvents: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          fromUser: true,
          toUser: true,
          actor: true,
        },
      },
    },
  })
}

export async function listAssignmentEvents(organizationId: string, opportunityId: string) {
  return prisma.assignmentEvent.findMany({
    where: { organizationId, opportunityId },
    include: { fromUser: true, toUser: true, actor: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function getPipelines(organizationId: string) {
  return prisma.pipeline.findMany({
    where: { organizationId },
    include: {
      stages: { orderBy: { position: "asc" } },
    },
    orderBy: { type: "asc" },
  })
}

export async function updatePipelineStage(
  organizationId: string,
  stageId: string,
  data: { name?: string; position?: number },
) {
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { organizationId } },
  })
  if (!stage) return null
  return prisma.pipelineStage.update({
    where: { id: stageId },
    data: {
      name: data.name ?? undefined,
      position: data.position ?? undefined,
    },
  })
}

export async function createOpportunity(
  organizationId: string,
  actorUserId: string,
  input: CreateOpportunityInput,
) {
  const data = createOpportunitySchema.parse(input)

  const contact = await prisma.contact.findFirst({
    where: { id: data.contactId, organizationId },
  })
  if (!contact) throw new Error("Contact not found in organization")

  const pipeline = await prisma.pipeline.findFirst({
    where: { organizationId, type: data.type, isDefault: true },
    include: { stages: { orderBy: { position: "asc" } } },
  })
  if (!pipeline || pipeline.stages.length === 0) {
    throw new Error("Default pipeline not found")
  }

  const stageKey = data.pipelineStageKey ?? "NEW"
  const stage = pipeline.stages.find((s) => s.key === stageKey) ?? pipeline.stages[0]

  const routed = await resolveRoutingAssignee(organizationId, {
    type: data.type,
    source: data.source ?? null,
    temperature: data.temperature,
    estimatedValue: data.estimatedValue ?? null,
  })

  const assigneeUserId = routed?.userId ?? actorUserId
  const assignmentSource: AuditSource = routed ? "SYSTEM" : "USER"
  const assignmentReason = routed
    ? `Routing rule: ${routed.ruleName}`
    : "Initial assignment on create"

  const opportunity = await prisma.opportunity.create({
    data: {
      organizationId,
      contactId: data.contactId,
      pipelineId: pipeline.id,
      pipelineStageId: stage.id,
      propertyId: data.propertyId ?? null,
      type: data.type,
      title: data.title,
      source: data.source ?? null,
      campaign: data.campaign ?? null,
      temperature: data.temperature,
      estimatedValue: data.estimatedValue ?? null,
      nextAction: data.nextAction ?? null,
      assignedToUserId: assigneeUserId,
      firstContactAt: new Date(),
    },
    include: { pipelineStage: true, contact: true, assignedTo: true },
  })

  await prisma.assignmentEvent.create({
    data: {
      organizationId,
      opportunityId: opportunity.id,
      toUserId: assigneeUserId,
      actorUserId,
      reason: assignmentReason,
      source: assignmentSource,
    },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: data.contactId,
      opportunityId: opportunity.id,
      actorUserId,
      type: "LEAD_ASSIGNMENT",
      subject: "Opportunity created",
      body: `${opportunity.title} → ${stage.name}${routed ? ` (routed: ${routed.ruleName})` : ""}`,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Opportunity",
    entityId: opportunity.id,
    action: "CREATE",
    after: {
      title: opportunity.title,
      stage: stage.key,
      assignedToUserId: assigneeUserId,
      routingRuleId: routed?.ruleId ?? null,
    },
    source: assignmentSource,
  })

  const { dispatchWorkflowEvent } = await import("@/domain/workflows/engine")
  void dispatchWorkflowEvent({
    organizationId,
    trigger: "OPPORTUNITY_CREATED",
    contactId: opportunity.contactId,
    opportunityId: opportunity.id,
    actorUserId,
    context: {
      type: opportunity.type,
      temperature: opportunity.temperature,
      stageKey: stage.key,
      source: opportunity.source,
    },
  })

  return opportunity
}

export async function moveOpportunityStage(
  organizationId: string,
  actorUserId: string,
  opportunityId: string,
  pipelineStageId: string,
) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
    include: { pipelineStage: true },
  })
  if (!opportunity) return null

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: pipelineStageId, pipeline: { organizationId } },
  })
  if (!stage) throw new Error("Stage not found")

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { pipelineStageId: stage.id },
    include: { pipelineStage: true, contact: true },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: opportunity.contactId,
      opportunityId,
      actorUserId,
      type: "STATUS_CHANGE",
      subject: "Stage changed",
      body: `${opportunity.pipelineStage.name} → ${stage.name}`,
      metadata: {
        fromStageId: opportunity.pipelineStageId,
        toStageId: stage.id,
      },
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Opportunity",
    entityId: opportunityId,
    action: "STAGE_CHANGE",
    before: { stageId: opportunity.pipelineStageId },
    after: { stageId: stage.id },
  })

  const { dispatchWorkflowEvent } = await import("@/domain/workflows/engine")
  void dispatchWorkflowEvent({
    organizationId,
    trigger: "STAGE_CHANGED",
    contactId: opportunity.contactId,
    opportunityId,
    actorUserId,
    context: {
      type: updated.type,
      temperature: updated.temperature,
      stageKey: stage.key,
      source: updated.source,
    },
  })

  return updated
}

export async function setOpportunityTemperature(
  organizationId: string,
  actorUserId: string,
  opportunityId: string,
  temperature: LeadTemperature,
) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
  })
  if (!opportunity) return null

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { temperature },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Opportunity",
    entityId: opportunityId,
    action: "TEMPERATURE_CHANGE",
    before: { temperature: opportunity.temperature },
    after: { temperature },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: opportunity.contactId,
      opportunityId,
      actorUserId,
      type: "STATUS_CHANGE",
      subject: "Temperature changed",
      body: `${opportunity.temperature} → ${temperature}`,
    },
  })

  return updated
}

export async function assignOpportunity(
  organizationId: string,
  actorUserId: string,
  opportunityId: string,
  toUserId: string,
  reason?: string,
  source: AuditSource = "USER",
) {
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
  })
  if (!opportunity) return null

  const membership = await prisma.membership.findFirst({
    where: { organizationId, userId: toUserId },
  })
  if (!membership) throw new Error("Assignee is not a member of this organization")

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { assignedToUserId: toUserId },
  })

  await prisma.assignmentEvent.create({
    data: {
      organizationId,
      opportunityId,
      fromUserId: opportunity.assignedToUserId,
      toUserId,
      actorUserId,
      reason: reason ?? "Manual reassignment",
      source,
    },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: opportunity.contactId,
      opportunityId,
      actorUserId,
      type: "LEAD_ASSIGNMENT",
      subject: "Lead reassigned",
      body: reason ?? "Manual reassignment",
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Opportunity",
    entityId: opportunityId,
    action: "ASSIGN",
    before: { assignedToUserId: opportunity.assignedToUserId },
    after: { assignedToUserId: toUserId },
    source,
  })

  return updated
}

export async function bulkUpdateOpportunities(
  organizationId: string,
  actorUserId: string,
  opportunityIds: string[],
  action: {
    pipelineStageId?: string
    temperature?: LeadTemperature
    assignToUserId?: string
  },
) {
  const ids = [...new Set(opportunityIds.filter(Boolean))]
  if (ids.length === 0) return { updated: 0 }

  const owned = await prisma.opportunity.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true },
  })
  const ownedIds = owned.map((o) => o.id)

  let updated = 0
  for (const id of ownedIds) {
    if (action.pipelineStageId) {
      await moveOpportunityStage(organizationId, actorUserId, id, action.pipelineStageId)
      updated++
    }
    if (action.temperature) {
      await setOpportunityTemperature(organizationId, actorUserId, id, action.temperature)
      updated++
    }
    if (action.assignToUserId) {
      await assignOpportunity(
        organizationId,
        actorUserId,
        id,
        action.assignToUserId,
        "Bulk reassignment",
      )
      updated++
    }
  }

  return { updated, count: ownedIds.length }
}

export function filtersToSearchParams(filters: OpportunityFilters): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    sp.set(key, String(value))
  }
  return sp
}

export function parseOpportunityFilters(
  params: Record<string, string | string[] | undefined>,
): OpportunityFilters {
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.length > 0) flat[k] = v
  }
  const parsed = opportunityFiltersSchema.safeParse(flat)
  return parsed.success ? parsed.data : {}
}
