import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createOrganizationForUser } from "@/domain/orgs/service"
import { createContact } from "@/domain/contacts/service"
import { createOpportunity } from "@/domain/opportunities/service"
import {
  addParty,
  createOffer,
  createTransactionFromOpportunity,
  setChecklistStatus,
  updateOfferStatus,
} from "@/domain/transactions/service"
import { createTransactionDocument } from "@/domain/transactions/documents"

const suffix = Date.now().toString(36)

describe("transactions domain", () => {
  let userId = ""
  let orgId = ""
  let otherOrgId = ""
  let contactId = ""
  let otherContactId = ""
  let opportunityId = ""

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: `Tx ${suffix}`,
        email: `tx-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    userId = user.id
    const org = await createOrganizationForUser({
      userId,
      name: `Tx Org ${suffix}`,
    })
    orgId = org.id

    const otherUser = await prisma.user.create({
      data: {
        name: `Tx Other ${suffix}`,
        email: `tx-other-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const otherOrg = await createOrganizationForUser({
      userId: otherUser.id,
      name: `Tx Other Org ${suffix}`,
    })
    otherOrgId = otherOrg.id

    const contact = await createContact(orgId, userId, {
      firstName: "Buyer",
      lastName: `Tx${suffix}`,
      contactType: "BUYER",
      email: `buyer-tx-${suffix}@example.com`,
    })
    contactId = contact.id

    const other = await createContact(otherOrgId, otherUser.id, {
      firstName: "Other",
      lastName: `Tx${suffix}`,
      contactType: "BUYER",
      email: `other-tx-${suffix}@example.com`,
    })
    otherContactId = other.id

    const opp = await createOpportunity(orgId, userId, {
      contactId,
      type: "BUYER",
      title: `Deal ${suffix}`,
      temperature: "WARM",
    })
    opportunityId = opp.id
  })

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [orgId, otherOrgId].filter(Boolean) } },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: [`tx-${suffix}@example.com`, `tx-other-${suffix}@example.com`] },
      },
    })
    await prisma.$disconnect()
  })

  it("creates transaction from opportunity with seeded checklist", async () => {
    const tx = await createTransactionFromOpportunity(orgId, userId, {
      opportunityId,
    })
    expect(tx.organizationId).toBe(orgId)
    expect(tx.opportunityId).toBe(opportunityId)
    expect(tx.parties.length).toBeGreaterThanOrEqual(1)
    expect(tx.checklist.length).toBeGreaterThanOrEqual(4)

    const again = await createTransactionFromOpportunity(orgId, userId, {
      opportunityId,
    })
    expect(again.id).toBe(tx.id)
  })

  it("rejects cross-org contact as party", async () => {
    const tx = await createTransactionFromOpportunity(orgId, userId, {
      opportunityId,
    })
    await expect(
      addParty(orgId, userId, tx.id, {
        role: "LENDER",
        contactId: otherContactId,
      }),
    ).rejects.toThrow(/not found/i)
  })

  it("updates offer status and accepts into under contract", async () => {
    const tx = await createTransactionFromOpportunity(orgId, userId, {
      opportunityId,
    })
    const offer = await createOffer(orgId, userId, tx.id, {
      amount: 425000,
      status: "SUBMITTED",
    })
    const updated = await updateOfferStatus(orgId, userId, offer.id, {
      status: "ACCEPTED",
    })
    expect(updated?.status).toBe("ACCEPTED")

    const fresh = await prisma.transaction.findUnique({ where: { id: tx.id } })
    expect(fresh?.status).toBe("UNDER_CONTRACT")
    expect(Number(fresh?.purchasePrice?.toString())).toBe(425000)
  })

  it("toggles checklist status", async () => {
    const tx = await createTransactionFromOpportunity(orgId, userId, {
      opportunityId,
    })
    const item = tx.checklist[0]
    expect(item).toBeTruthy()
    const updated = await setChecklistStatus(orgId, userId, item!.id, "DONE")
    expect(updated?.status).toBe("DONE")
  })

  it("stores mock document key and optional envelope", async () => {
    const tx = await createTransactionFromOpportunity(orgId, userId, {
      opportunityId,
    })
    const doc = await createTransactionDocument(orgId, userId, tx.id, {
      name: "PSA.pdf",
      createEnvelope: true,
    })
    expect(doc.storageKey).toContain(tx.id)
    expect(doc.esignEnvelopeId).toMatch(/^mock-esign-/)
  })
})
