import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createOrganizationForUser } from "@/domain/orgs/service"
import { createContact } from "@/domain/contacts/service"
import { renderTemplate, buildMergeVars } from "@/domain/comms/consent"
import {
  parseCampaignDefinition,
  MAX_CAMPAIGN_ENROLLMENTS,
} from "@/domain/campaigns/definition"
import {
  approveCampaign,
  createCampaign,
  previewAudienceCount,
  resolveAudienceContacts,
  submitCampaignForApproval,
} from "@/domain/campaigns/service"
import { enrollAudience, processDueCampaignEnrollments } from "@/domain/campaigns/engine"

const suffix = Date.now().toString(36)

describe("campaign definition + merge", () => {
  it("parses drip steps", () => {
    const def = parseCampaignDefinition({
      entryKey: "d1",
      steps: [
        { key: "d1", type: "DELAY", waitHours: 2, nextKey: "e1" },
        {
          key: "e1",
          type: "SEND_EMAIL",
          subject: "Hi {{firstName}}",
          body: "Hello",
          nextKey: "x",
        },
        { key: "x", type: "EXIT" },
      ],
    })
    expect(def.steps).toHaveLength(3)
  })

  it("renders expanded merge vars", () => {
    const out = renderTemplate(
      "Hi {{preferredName}} at {{email}} / {{phone}} — {{organizationName}}",
      buildMergeVars({
        firstName: "Pat",
        lastName: "Lee",
        preferredName: "Patty",
        email: "pat@example.com",
        phone: "555",
        organizationName: "Acme Realty",
      }),
    )
    expect(out).toContain("Patty")
    expect(out).toContain("pat@example.com")
    expect(out).toContain("Acme Realty")
  })
})

describe("campaign lifecycle", () => {
  let userId = ""
  let orgId = ""
  let otherOrgId = ""
  let contactId = ""
  let otherContactId = ""

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: `Camp ${suffix}`,
        email: `camp-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    userId = user.id
    const org = await createOrganizationForUser({
      userId,
      name: `Camp Org ${suffix}`,
    })
    orgId = org.id

    const otherUser = await prisma.user.create({
      data: {
        name: `Camp Other ${suffix}`,
        email: `camp-other-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const otherOrg = await createOrganizationForUser({
      userId: otherUser.id,
      name: `Camp Other Org ${suffix}`,
    })
    otherOrgId = otherOrg.id

    const contact = await createContact(orgId, userId, {
      firstName: "Casey",
      lastName: `Buyer${suffix}`,
      contactType: "BUYER",
      email: `casey-camp-${suffix}@example.com`,
      phone: "4145550199",
      consentEmail: true,
      consentSms: true,
    })
    contactId = contact.id

    const other = await createContact(otherOrgId, otherUser.id, {
      firstName: "Other",
      lastName: `Buyer${suffix}`,
      contactType: "BUYER",
      email: `other-camp-${suffix}@example.com`,
      consentEmail: true,
    })
    otherContactId = other.id
  })

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [orgId, otherOrgId].filter(Boolean) } },
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [`camp-${suffix}@example.com`, `camp-other-${suffix}@example.com`],
        },
      },
    })
    await prisma.$disconnect()
  })

  const dripDef = {
    entryKey: "delay1",
    steps: [
      { key: "delay1", type: "DELAY" as const, waitHours: 1, nextKey: "email1" },
      {
        key: "email1",
        type: "SEND_EMAIL" as const,
        subject: "Hi {{firstName}}",
        body: "Hello {{firstName}} from {{organizationName}}",
        nextKey: "exit",
      },
      { key: "exit", type: "EXIT" as const },
    ],
  }

  it("audience is org-scoped", async () => {
    const contacts = await resolveAudienceContacts(orgId, "EMAIL", {
      requireConsent: true,
      contactType: "BUYER",
    })
    expect(contacts.some((c) => c.id === contactId)).toBe(true)
    expect(contacts.some((c) => c.id === otherContactId)).toBe(false)
  })

  it("cannot enroll while DRAFT", async () => {
    const campaign = await createCampaign(orgId, userId, {
      name: `Draft ${suffix}`,
      channel: "EMAIL",
      definition: dripDef,
      audience: { requireConsent: true, contactType: "BUYER" },
    })
    await expect(
      enrollAudience({
        organizationId: orgId,
        actorUserId: userId,
        campaignId: campaign.id,
      }),
    ).rejects.toThrow(/ACTIVE/)
  })

  it("approve then enroll + delay schedules nextRunAt", async () => {
    const campaign = await createCampaign(orgId, userId, {
      name: `Live ${suffix}`,
      channel: "EMAIL",
      definition: dripDef,
      audience: { requireConsent: true, contactType: "BUYER" },
    })
    await submitCampaignForApproval(orgId, userId, campaign.id)
    await approveCampaign(orgId, userId, campaign.id)

    const count = await previewAudienceCount(orgId, "EMAIL", {
      requireConsent: true,
      contactType: "BUYER",
    })
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(MAX_CAMPAIGN_ENROLLMENTS)

    const enroll = await enrollAudience({
      organizationId: orgId,
      actorUserId: userId,
      campaignId: campaign.id,
    })
    expect(enroll.created).toBeGreaterThanOrEqual(1)

    // Force due
    await prisma.campaignEnrollment.updateMany({
      where: { campaignId: campaign.id, status: "ACTIVE" },
      data: { nextRunAt: new Date(Date.now() - 60_000) },
    })

    const tick1 = await processDueCampaignEnrollments(orgId)
    expect(tick1.processed).toBeGreaterThanOrEqual(1)

    const afterDelay = await prisma.campaignEnrollment.findFirst({
      where: { campaignId: campaign.id, contactId },
    })
    expect(afterDelay?.currentStepKey).toBe("email1")
    expect(afterDelay?.nextRunAt).toBeTruthy()
    expect(afterDelay?.nextRunAt!.getTime()).toBeGreaterThan(Date.now())
  })

  it("skips contacts without consent from audience", async () => {
    await prisma.contact.update({
      where: { id: contactId },
      data: { consentEmail: false },
    })
    const count = await previewAudienceCount(orgId, "EMAIL", {
      requireConsent: true,
      contactType: "BUYER",
    })
    expect(count).toBe(0)
    await prisma.contact.update({
      where: { id: contactId },
      data: { consentEmail: true },
    })
  })
})
