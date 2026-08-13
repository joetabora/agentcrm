import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type { LeadTemperature, OpportunityType, Prisma } from "@/generated/prisma/client"
import { z } from "zod"

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

export async function listOpportunities(
  organizationId: string,
  filters?: {
    type?: OpportunityType
    stageKey?: string
    temperature?: LeadTemperature
    pipelineId?: string
  },
) {
  const where: Prisma.OpportunityWhereInput = { organizationId }
  if (filters?.type) where.type = filters.type
  if (filters?.temperature) where.temperature = filters.temperature
  if (filters?.pipelineId) where.pipelineId = filters.pipelineId
  if (filters?.stageKey) {
    where.pipelineStage = { key: filters.stageKey }
  }

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

export async function getPipelines(organizationId: string) {
  return prisma.pipeline.findMany({
    where: { organizationId },
    include: {
      stages: { orderBy: { position: "asc" } },
    },
    orderBy: { type: "asc" },
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
      assignedToUserId: actorUserId,
      firstContactAt: new Date(),
    },
    include: { pipelineStage: true, contact: true },
  })

  await prisma.assignmentEvent.create({
    data: {
      organizationId,
      opportunityId: opportunity.id,
      toUserId: actorUserId,
      actorUserId,
      reason: "Initial assignment on create",
      source: "USER",
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
      body: `${opportunity.title} → ${stage.name}`,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Opportunity",
    entityId: opportunity.id,
    action: "CREATE",
    after: { title: opportunity.title, stage: stage.key },
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

  return updated
}

export async function assignOpportunity(
  organizationId: string,
  actorUserId: string,
  opportunityId: string,
  toUserId: string,
  reason?: string,
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
      source: "USER",
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

  return updated
}
