import { addHours } from "date-fns"
import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import { sendEmail, sendSms } from "@/domain/comms/service"
import {
  MAX_CAMPAIGN_ENROLLMENTS,
  getStepMap,
  parseCampaignDefinition,
  type CampaignStep,
} from "@/domain/campaigns/definition"
import {
  filterConsentingContacts,
  resolveAudienceContacts,
} from "@/domain/campaigns/service"

export async function enrollAudience(input: {
  organizationId: string
  actorUserId: string
  campaignId: string
}) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, organizationId: input.organizationId },
  })
  if (!campaign) throw new Error("Campaign not found")
  if (campaign.status !== "ACTIVE") {
    throw new Error("Campaign must be ACTIVE to enroll audience")
  }

  const definition = parseCampaignDefinition(campaign.definition)
  const contacts = await resolveAudienceContacts(
    input.organizationId,
    campaign.channel,
    campaign.audience,
    MAX_CAMPAIGN_ENROLLMENTS,
  )
  const eligible = filterConsentingContacts(contacts, campaign.channel)

  let created = 0
  let skipped = 0
  for (const contact of eligible) {
    const existing = await prisma.campaignEnrollment.findUnique({
      where: {
        campaignId_contactId: {
          campaignId: campaign.id,
          contactId: contact.id,
        },
      },
    })
    if (existing) {
      skipped += 1
      continue
    }
    await prisma.campaignEnrollment.create({
      data: {
        organizationId: input.organizationId,
        campaignId: campaign.id,
        contactId: contact.id,
        status: "ACTIVE",
        currentStepKey: definition.entryKey,
        nextRunAt: new Date(),
      },
    })
    created += 1
  }

  await writeAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "Campaign",
    entityId: campaign.id,
    action: "ENROLL",
    after: {
      created,
      skipped,
      considered: eligible.length,
      cappedAt: MAX_CAMPAIGN_ENROLLMENTS,
    },
    source: "SYSTEM",
  })

  return { created, skipped, considered: eligible.length }
}

export async function processDueCampaignEnrollments(organizationId?: string) {
  const now = new Date()
  const due = await prisma.campaignEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      ...(organizationId ? { organizationId } : {}),
      campaign: { status: "ACTIVE" },
    },
    take: 100,
    include: { campaign: true },
    orderBy: { nextRunAt: "asc" },
  })

  let processed = 0
  let errors = 0

  for (const enrollment of due) {
    try {
      await advanceEnrollment(enrollment.id)
      processed += 1
    } catch (err) {
      errors += 1
      const message = err instanceof Error ? err.message : "Campaign step failed"
      await prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "ERROR", lastError: message, exitedAt: new Date() },
      })
    }
  }

  return { processed, errors, scanned: due.length }
}

async function advanceEnrollment(enrollmentId: string) {
  const enrollment = await prisma.campaignEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { campaign: true },
  })
  if (!enrollment || enrollment.status !== "ACTIVE") return
  if (enrollment.campaign.status !== "ACTIVE") {
    await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "EXITED",
        lastError: "Campaign not active",
        exitedAt: new Date(),
        nextRunAt: null,
      },
    })
    return
  }

  const definition = parseCampaignDefinition(enrollment.campaign.definition)
  const steps = getStepMap(definition)
  const stepKey = enrollment.currentStepKey ?? definition.entryKey
  const step = steps.get(stepKey)
  if (!step) {
    throw new Error(`Unknown step ${stepKey}`)
  }

  if (step.type === "DELAY") {
    await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStepKey: step.nextKey,
        nextRunAt: addHours(new Date(), step.waitHours),
        lastError: null,
      },
    })
    return
  }

  if (step.type === "EXIT") {
    await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "COMPLETED",
        currentStepKey: step.key,
        nextRunAt: null,
        exitedAt: new Date(),
      },
    })
    return
  }

  if (step.type === "SEND_EMAIL" || step.type === "SEND_SMS") {
    await executeSendStep(enrollment, step)
    const nextKey = step.nextKey
    if (!nextKey) {
      await prisma.campaignEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: "COMPLETED",
          currentStepKey: step.key,
          nextRunAt: null,
          exitedAt: new Date(),
        },
      })
      return
    }
    await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStepKey: nextKey,
        nextRunAt: new Date(),
        lastError: null,
      },
    })
  }
}

async function executeSendStep(
  enrollment: {
    id: string
    organizationId: string
    contactId: string
    campaignId: string
  },
  step: Extract<CampaignStep, { type: "SEND_EMAIL" | "SEND_SMS" }>,
) {
  if (step.type === "SEND_EMAIL") {
    const result = await sendEmail({
      organizationId: enrollment.organizationId,
      actorUserId: null,
      contactId: enrollment.contactId,
      subject: step.subject ?? null,
      body: step.body ?? null,
      templateId: step.templateId ?? null,
      source: "SYSTEM",
      skipOnBlock: true,
    })
    if (!result.ok) throw new Error(result.error)
    await writeAuditLog({
      organizationId: enrollment.organizationId,
      entityType: "CampaignEnrollment",
      entityId: enrollment.id,
      action: "SEND",
      after: {
        channel: "EMAIL",
        skipped: "skipped" in result ? result.skipped : false,
        campaignId: enrollment.campaignId,
      },
      source: "SYSTEM",
    })
    return
  }

  const result = await sendSms({
    organizationId: enrollment.organizationId,
    actorUserId: null,
    contactId: enrollment.contactId,
    body: step.body ?? null,
    templateId: step.templateId ?? null,
    source: "SYSTEM",
    skipOnBlock: true,
  })
  if (!result.ok) throw new Error(result.error)
  await writeAuditLog({
    organizationId: enrollment.organizationId,
    entityType: "CampaignEnrollment",
    entityId: enrollment.id,
    action: "SEND",
    after: {
      channel: "SMS",
      skipped: "skipped" in result ? result.skipped : false,
      campaignId: enrollment.campaignId,
    },
    source: "SYSTEM",
  })
}

export async function tickCampaignsForOrg(organizationId: string) {
  return processDueCampaignEnrollments(organizationId)
}
