import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createOrganizationForUser } from "@/domain/orgs/service"
import { createContact } from "@/domain/contacts/service"
import { buildCrmContext } from "@/domain/ai/context"
import {
  askAssistant,
  parseAssistantResponse,
  assistantResponseSchema,
  claimKindSchema,
} from "@/domain/ai/assistant"
import { MockAIProvider, getAIProvider } from "@/providers/ai"

const suffix = Date.now().toString(36)

describe("assistant claim schemas", () => {
  it("accepts labeled claim kinds", () => {
    for (const kind of ["FACT", "CALCULATION", "INFERENCE", "UNKNOWN"] as const) {
      expect(claimKindSchema.parse(kind)).toBe(kind)
    }
  })

  it("parses valid assistant JSON", () => {
    const parsed = assistantResponseSchema.parse({
      answerMarkdown: "Budget is $500k",
      claims: [{ text: "budgetMax=500000", kind: "FACT", sourceIds: ["c1"] }],
      refused: false,
    })
    expect(parsed.claims[0]?.kind).toBe("FACT")
  })

  it("parseAssistantResponse refuses on invalid JSON", () => {
    const r = parseAssistantResponse("not json at all")
    expect(r.refused).toBe(true)
    expect(r.claims.some((c) => c.kind === "UNKNOWN")).toBe(true)
  })

  it("parseAssistantResponse extracts embedded JSON", () => {
    const r = parseAssistantResponse(
      'Here you go:\n{"answerMarkdown":"Hi","claims":[{"text":"x","kind":"FACT"}]}\n',
    )
    expect(r.refused).toBeFalsy()
    expect(r.answerMarkdown).toBe("Hi")
  })
})

describe("AI provider factory", () => {
  it("returns mock when OPENAI_API_KEY unset", async () => {
    const prev = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    const p = getAIProvider()
    expect(p.name).toBe("mock")
    const result = await p.complete({
      messages: [{ role: "user", content: "hi" }],
    })
    expect(result.provider).toBe("mock")
    const parsed = parseAssistantResponse(result.content)
    expect(parsed.refused).toBe(true)
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev
  })

  it("MockAIProvider returns safe refusal JSON", async () => {
    const mock = new MockAIProvider()
    const result = await mock.complete({ messages: [] })
    expect(result.model).toBe("mock-none")
  })
})

describe("CRM context + askAssistant", () => {
  let userId = ""
  let orgId = ""
  let otherOrgId = ""
  let contactId = ""
  let otherContactId = ""

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: `AI Test ${suffix}`,
        email: `ai-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    userId = user.id
    const org = await createOrganizationForUser({
      userId,
      name: `AI Org ${suffix}`,
    })
    orgId = org.id

    const otherUser = await prisma.user.create({
      data: {
        name: `AI Other ${suffix}`,
        email: `ai-other-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const otherOrg = await createOrganizationForUser({
      userId: otherUser.id,
      name: `AI Other Org ${suffix}`,
    })
    otherOrgId = otherOrg.id

    const contact = await createContact(orgId, userId, {
      firstName: "Casey",
      lastName: `Buyer${suffix}`,
      contactType: "BUYER",
      email: `casey-${suffix}@example.com`,
    })
    contactId = contact.id
    await prisma.contact.update({
      where: { id: contactId },
      data: { budgetMax: 450000 },
    })

    const other = await createContact(otherOrgId, otherUser.id, {
      firstName: "Secret",
      lastName: `Other${suffix}`,
      contactType: "BUYER",
      email: `secret-${suffix}@example.com`,
    })
    otherContactId = other.id
    await prisma.contact.update({
      where: { id: otherContactId },
      data: { budgetMax: 999999 },
    })
  })

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [orgId, otherOrgId].filter(Boolean) } },
    })
    await prisma.user.deleteMany({
      where: { email: { contains: `ai-${suffix}` } },
    })
    await prisma.user.deleteMany({
      where: { email: { contains: `ai-other-${suffix}` } },
    })
    await prisma.$disconnect()
  })

  it("empty brand-new org context is empty", async () => {
    const emptyUser = await prisma.user.create({
      data: {
        name: `Empty ${suffix}`,
        email: `empty-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const emptyOrg = await createOrganizationForUser({
      userId: emptyUser.id,
      name: `Empty Org ${suffix}`,
    })
    const pack = await buildCrmContext({ organizationId: emptyOrg.id })
    expect(pack.empty).toBe(true)
    await prisma.organization.delete({ where: { id: emptyOrg.id } })
    await prisma.user.delete({ where: { id: emptyUser.id } })
  })

  it("never includes other-org contact ids in context text", async () => {
    const pack = await buildCrmContext({
      organizationId: orgId,
      contactId,
    })
    expect(pack.empty).toBe(false)
    expect(pack.text).toContain(contactId)
    expect(pack.text).not.toContain(otherContactId)
    expect(pack.text).not.toContain("999999")

    const cross = await buildCrmContext({
      organizationId: orgId,
      contactId: otherContactId,
    })
    expect(cross.empty).toBe(true)
  })

  it("askAssistant refuses when context empty", async () => {
    const emptyUser = await prisma.user.create({
      data: {
        name: `AskEmpty ${suffix}`,
        email: `askempty-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const emptyOrg = await createOrganizationForUser({
      userId: emptyUser.id,
      name: `Ask Empty Org ${suffix}`,
    })
    const result = await askAssistant({
      organizationId: emptyOrg.id,
      actorUserId: emptyUser.id,
      question: "What is the budget?",
    })
    expect(result.response.refused).toBe(true)
    expect(result.contextEmpty).toBe(true)
    expect(result.response.refuseReason).toMatch(/empty/i)

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: emptyOrg.id,
        entityType: "AssistantQuery",
        source: "AI",
      },
    })
    expect(logs.length).toBeGreaterThan(0)

    await prisma.organization.delete({ where: { id: emptyOrg.id } })
    await prisma.user.delete({ where: { id: emptyUser.id } })
  })

  it("askAssistant uses mock provider without inventing other-org data", async () => {
    const prev = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    const result = await askAssistant({
      organizationId: orgId,
      actorUserId: userId,
      question: "Summarize this buyer",
      contactId,
    })
    expect(result.provider).toBe("mock")
    expect(result.response.refused).toBe(true)
    expect(result.sources.some((s) => s.id === contactId)).toBe(true)
    expect(result.sources.some((s) => s.id === otherContactId)).toBe(false)
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev
  })
})
