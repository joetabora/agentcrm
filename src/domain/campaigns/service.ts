import { z } from "zod"
import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type { CommChannel, Prisma } from "@/generated/prisma/client"
import {
  MAX_CAMPAIGN_ENROLLMENTS,
  parseCampaignAudience,
  parseCampaignDefinition,
  type CampaignAudience,
  type CampaignDefinition,
  campaignAudienceSchema,
  campaignDefinitionSchema,
} from "@/domain/campaigns/definition"
import { assertCanSend } from "@/domain/comms/consent"

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  channel: z.enum(["EMAIL", "SMS"]),
  definition: campaignDefinitionSchema,
  audience: campaignAudienceSchema.default({ requireConsent: true }),
})

export type CreateCampaignInput = z.input<typeof createCampaignSchema>

export async function listCampaigns(organizationId: string) {
  return prisma.campaign.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { enrollments: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  })
}

export async function getCampaign(organizationId: string, campaignId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: {
      approvedBy: { select: { id: true, name: true } },
      enrollments: {
        take: 50,
        orderBy: { enrolledAt: "desc" },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  })
}

export function buildAudienceWhere(
  organizationId: string,
  channel: CommChannel,
  audience: CampaignAudience,
): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = {
    organizationId,
    doNotContact: false,
  }
  if (channel === "EMAIL") where.consentEmail = true
  if (channel === "SMS") where.consentSms = true
  if (audience.contactType) where.contactType = audience.contactType
  if (audience.lifecycleStage) where.lifecycleStage = audience.lifecycleStage
  if (audience.temperature) where.temperature = audience.temperature
  if (audience.sourceContains?.trim()) {
    where.source = { contains: audience.sourceContains.trim(), mode: "insensitive" }
  }
  if (audience.tagName?.trim()) {
    where.tags = {
      some: {
        tag: {
          organizationId,
          name: { equals: audience.tagName.trim(), mode: "insensitive" },
        },
      },
    }
  }
  return where
}

export async function resolveAudienceContacts(
  organizationId: string,
  channel: CommChannel,
  audienceRaw: unknown,
  take = MAX_CAMPAIGN_ENROLLMENTS,
) {
  const audience = parseCampaignAudience(audienceRaw)
  return prisma.contact.findMany({
    where: buildAudienceWhere(organizationId, channel, audience),
    take,
    orderBy: { updatedAt: "desc" },
    include: { emails: true, phones: true },
  })
}

export async function previewAudienceCount(
  organizationId: string,
  channel: CommChannel,
  audienceRaw: unknown,
) {
  const audience = parseCampaignAudience(audienceRaw)
  return prisma.contact.count({
    where: buildAudienceWhere(organizationId, channel, audience),
  })
}

export async function createCampaign(
  organizationId: string,
  actorUserId: string,
  input: CreateCampaignInput,
) {
  const data = createCampaignSchema.parse(input)
  parseCampaignDefinition(data.definition)

  const campaign = await prisma.campaign.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description ?? null,
      channel: data.channel,
      status: "DRAFT",
      definition: data.definition as Prisma.InputJsonValue,
      audience: data.audience as Prisma.InputJsonValue,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Campaign",
    entityId: campaign.id,
    action: "CREATE",
    after: { name: campaign.name, channel: campaign.channel, status: campaign.status },
  })

  return campaign
}

export async function submitCampaignForApproval(
  organizationId: string,
  actorUserId: string,
  campaignId: string,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
  })
  if (!campaign) return null
  if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
    throw new Error("Only DRAFT or PAUSED campaigns can be submitted")
  }
  parseCampaignDefinition(campaign.definition)

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PENDING_APPROVAL" },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Campaign",
    entityId: campaignId,
    action: "SUBMIT",
    before: { status: campaign.status },
    after: { status: updated.status },
  })

  return updated
}

export async function approveCampaign(
  organizationId: string,
  actorUserId: string,
  campaignId: string,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
  })
  if (!campaign) return null
  if (campaign.status !== "PENDING_APPROVAL") {
    throw new Error("Campaign must be PENDING_APPROVAL to approve")
  }
  parseCampaignDefinition(campaign.definition)

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "ACTIVE",
      approvedAt: new Date(),
      approvedByUserId: actorUserId,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Campaign",
    entityId: campaignId,
    action: "APPROVE",
    before: { status: campaign.status },
    after: { status: updated.status },
  })

  return updated
}

export async function pauseCampaign(
  organizationId: string,
  actorUserId: string,
  campaignId: string,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
  })
  if (!campaign) return null
  if (campaign.status !== "ACTIVE") {
    throw new Error("Only ACTIVE campaigns can be paused")
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Campaign",
    entityId: campaignId,
    action: "PAUSE",
    before: { status: campaign.status },
    after: { status: updated.status },
  })

  return updated
}

export async function archiveCampaign(
  organizationId: string,
  actorUserId: string,
  campaignId: string,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
  })
  if (!campaign) return null

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "ARCHIVED" },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Campaign",
    entityId: campaignId,
    action: "ARCHIVE",
    before: { status: campaign.status },
    after: { status: updated.status },
  })

  return updated
}

export async function listCampaignEnrollments(
  organizationId: string,
  campaignId: string,
  take = 50,
) {
  return prisma.campaignEnrollment.findMany({
    where: { organizationId, campaignId },
    take,
    orderBy: { enrolledAt: "desc" },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  })
}

/** Filter contacts that pass consent for the campaign channel. */
export function filterConsentingContacts<
  T extends {
    doNotContact: boolean
    consentEmail: boolean
    consentSms: boolean
    consentCall: boolean
  },
>(contacts: T[], channel: CommChannel) {
  return contacts.filter((c) => assertCanSend(c, channel).allowed)
}

export type { CampaignDefinition, CampaignAudience }
