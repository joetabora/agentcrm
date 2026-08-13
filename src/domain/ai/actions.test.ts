import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createOrganizationForUser } from "@/domain/orgs/service"
import { createContact } from "@/domain/contacts/service"
import { parseAssistantResponse } from "@/domain/ai/assistant"
import { confirmAssistantAction } from "@/domain/ai/execute"
import {
  canConfirmTool,
  parseToolArgs,
  riskForTool,
  toolCatalogForPrompt,
} from "@/domain/ai/tools"

const suffix = Date.now().toString(36)

describe("tool registry + permissions", () => {
  it("assigns risk levels", () => {
    expect(riskForTool("create_task")).toBe("low")
    expect(riskForTool("send_email")).toBe("high")
    expect(riskForTool("enroll_workflow")).toBe("high")
  })

  it("ASSISTANT cannot confirm high-risk tools", () => {
    expect(canConfirmTool("ASSISTANT", "create_task")).toBe(true)
    expect(canConfirmTool("ASSISTANT", "add_note")).toBe(true)
    expect(canConfirmTool("ASSISTANT", "save_contact_fact")).toBe(true)
    expect(canConfirmTool("ASSISTANT", "send_email")).toBe(false)
    expect(canConfirmTool("ASSISTANT", "send_sms")).toBe(false)
    expect(canConfirmTool("ASSISTANT", "enroll_workflow")).toBe(false)
    expect(canConfirmTool("ASSISTANT", "move_opportunity_stage")).toBe(false)
  })

  it("AGENT can confirm all tools", () => {
    expect(canConfirmTool("AGENT", "send_email")).toBe(true)
    expect(canConfirmTool("OWNER", "enroll_workflow")).toBe(true)
  })

  it("parses create_task args", () => {
    const args = parseToolArgs("create_task", {
      title: "Follow up",
      contactId: "c1",
      priority: "HIGH",
    })
    expect(args.title).toBe("Follow up")
  })

  it("rejects send_email without body or template", () => {
    expect(() =>
      parseToolArgs("send_email", { contactId: "c1", subject: "Hi" }),
    ).toThrow()
  })

  it("exposes catalog for prompt", () => {
    expect(toolCatalogForPrompt()).toContain("create_task")
    expect(toolCatalogForPrompt()).toContain("send_sms")
  })
})

describe("proposedActions parsing", () => {
  it("parses proposedActions and normalizes risk", () => {
    const r = parseAssistantResponse(
      JSON.stringify({
        answerMarkdown: "I can create a follow-up task.",
        claims: [{ text: "Next action missing", kind: "INFERENCE" }],
        proposedActions: [
          {
            id: "a1",
            tool: "create_task",
            args: { title: "Call back", contactId: "abc" },
            rationale: "No open task",
          },
        ],
      }),
    )
    expect(r.proposedActions).toHaveLength(1)
    expect(r.proposedActions[0]?.risk).toBe("low")
    expect(r.proposedActions[0]?.tool).toBe("create_task")
  })

  it("drops invalid proposed tools via refuse path", () => {
    const r = parseAssistantResponse(
      JSON.stringify({
        answerMarkdown: "x",
        claims: [],
        proposedActions: [{ id: "a1", tool: "delete_org", args: {}, rationale: "nope" }],
      }),
    )
    expect(r.refused).toBe(true)
    expect(r.proposedActions).toHaveLength(0)
  })
})

describe("confirmAssistantAction execution", () => {
  let userId = ""
  let orgId = ""
  let otherOrgId = ""
  let contactId = ""
  let otherContactId = ""

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: `P8 ${suffix}`,
        email: `p8-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    userId = user.id
    const org = await createOrganizationForUser({
      userId,
      name: `P8 Org ${suffix}`,
    })
    orgId = org.id

    const otherUser = await prisma.user.create({
      data: {
        name: `P8 Other ${suffix}`,
        email: `p8-other-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const otherOrg = await createOrganizationForUser({
      userId: otherUser.id,
      name: `P8 Other Org ${suffix}`,
    })
    otherOrgId = otherOrg.id

    const contact = await createContact(orgId, userId, {
      firstName: "Pat",
      lastName: `Lead${suffix}`,
      contactType: "BUYER",
      email: `pat-${suffix}@example.com`,
    })
    contactId = contact.id

    const other = await createContact(otherOrgId, otherUser.id, {
      firstName: "Other",
      lastName: `Lead${suffix}`,
      contactType: "BUYER",
      email: `other-${suffix}@example.com`,
    })
    otherContactId = other.id
  })

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [orgId, otherOrgId].filter(Boolean) } },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: [`p8-${suffix}@example.com`, `p8-other-${suffix}@example.com`] },
      },
    })
    await prisma.$disconnect()
  })

  it("creates a task on confirm", async () => {
    const result = await confirmAssistantAction({
      organizationId: orgId,
      actorUserId: userId,
      role: "AGENT",
      tool: "create_task",
      args: { title: `AI task ${suffix}`, contactId, priority: "MEDIUM" },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const task = await prisma.task.findFirst({
      where: { id: result.resultId, organizationId: orgId },
    })
    expect(task?.title).toContain("AI task")
  })

  it("rejects cross-org contact for create_task", async () => {
    const result = await confirmAssistantAction({
      organizationId: orgId,
      actorUserId: userId,
      role: "AGENT",
      tool: "create_task",
      args: { title: "Leak", contactId: otherContactId },
    })
    expect(result.ok).toBe(false)
  })

  it("denies ASSISTANT confirming send_email", async () => {
    const result = await confirmAssistantAction({
      organizationId: orgId,
      actorUserId: userId,
      role: "ASSISTANT",
      tool: "send_email",
      args: { contactId, subject: "Hi", body: "Hello" },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.denied).toBe(true)
  })
})
