import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createOrganizationForUser } from "@/domain/orgs/service"
import { createContact, getContact, listContacts } from "@/domain/contacts/service"
import {
  bulkUpdateOpportunities,
  createOpportunity,
  listOpportunities,
  moveOpportunityStage,
} from "@/domain/opportunities/service"
import { createTask, listTasks, completeTask, snoozeTask } from "@/domain/tasks/service"
import { globalSearch } from "@/domain/search/service"

const suffix = Date.now().toString(36)

describe("tenant isolation + core domain", () => {
  let userAId = ""
  let userBId = ""
  let orgAId = ""
  let orgBId = ""
  let contactAId = ""
  let contactBId = ""

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: {
        name: `Test A ${suffix}`,
        email: `test-a-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const userB = await prisma.user.create({
      data: {
        name: `Test B ${suffix}`,
        email: `test-b-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    userAId = userA.id
    userBId = userB.id

    const orgA = await createOrganizationForUser({
      userId: userAId,
      name: `Org A ${suffix}`,
    })
    const orgB = await createOrganizationForUser({
      userId: userBId,
      name: `Org B ${suffix}`,
    })
    orgAId = orgA.id
    orgBId = orgB.id

    const cA = await createContact(orgAId, userAId, {
      firstName: "Alice",
      lastName: `TenantA${suffix}`,
      contactType: "LEAD",
      email: `alice-${suffix}@example.com`,
      phone: "4145550101",
    })
    const cB = await createContact(orgBId, userBId, {
      firstName: "Bob",
      lastName: `TenantB${suffix}`,
      contactType: "LEAD",
      email: `bob-${suffix}@example.com`,
      phone: "4145550102",
    })
    contactAId = cA.id
    contactBId = cB.id
  })

  afterAll(async () => {
    // Cascade via org delete
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId].filter(Boolean) } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId].filter(Boolean) } },
    })
    await prisma.$disconnect()
  })

  it("does not leak contacts across organizations", async () => {
    const listA = await listContacts(orgAId)
    const listB = await listContacts(orgBId)

    expect(listA.some((c) => c.id === contactAId)).toBe(true)
    expect(listA.some((c) => c.id === contactBId)).toBe(false)
    expect(listB.some((c) => c.id === contactBId)).toBe(true)
    expect(listB.some((c) => c.id === contactAId)).toBe(false)

    const cross = await getContact(orgAId, contactBId)
    expect(cross).toBeNull()
  })

  it("creates opportunities only within tenant pipelines", async () => {
    const opp = await createOpportunity(orgAId, userAId, {
      contactId: contactAId,
      type: "BUYER",
      title: `Buyer opp ${suffix}`,
      temperature: "HOT",
    })
    expect(opp.organizationId).toBe(orgAId)

    const listedB = await listOpportunities(orgBId)
    expect(listedB.some((o) => o.id === opp.id)).toBe(false)

    await expect(
      createOpportunity(orgAId, userAId, {
        contactId: contactBId,
        type: "BUYER",
        title: "should fail",
        temperature: "WARM",
      }),
    ).rejects.toThrow(/Contact not found/)
  })

  it("audits stage moves and keeps tasks tenant-scoped", async () => {
    const opp = await createOpportunity(orgAId, userAId, {
      contactId: contactAId,
      type: "SELLER",
      title: `Seller opp ${suffix}`,
      temperature: "WARM",
    })

    const pipelines = await prisma.pipeline.findFirstOrThrow({
      where: { organizationId: orgAId, type: "SELLER" },
      include: { stages: { orderBy: { position: "asc" } } },
    })
    const nextStage = pipelines.stages[1]
    const moved = await moveOpportunityStage(orgAId, userAId, opp.id, nextStage.id)
    expect(moved?.pipelineStageId).toBe(nextStage.id)

    const activity = await prisma.activity.findFirst({
      where: { organizationId: orgAId, opportunityId: opp.id, type: "STATUS_CHANGE" },
    })
    expect(activity).toBeTruthy()

    const task = await createTask(orgAId, userAId, {
      title: `Call ${suffix}`,
      priority: "HIGH",
      contactId: contactAId,
      opportunityId: opp.id,
    })
    const tasksB = await listTasks(orgBId, { status: "OPEN" })
    expect(tasksB.some((t) => t.id === task.id)).toBe(false)

    const completed = await completeTask(orgAId, userAId, task.id)
    expect(completed?.task.status).toBe("COMPLETED")
  })

  it("search respects organizationId", async () => {
    const resultsA = await globalSearch(orgAId, `TenantA${suffix}`)
    const resultsB = await globalSearch(orgBId, `TenantA${suffix}`)
    expect(resultsA.some((r) => r.id === contactAId)).toBe(true)
    expect(resultsB.some((r) => r.id === contactAId)).toBe(false)
  })

  it("bulk updates only opportunities in the actor org", async () => {
    const oppA = await createOpportunity(orgAId, userAId, {
      contactId: contactAId,
      type: "BUYER",
      title: `Bulk A ${suffix}`,
      temperature: "COLD",
    })
    const oppB = await createOpportunity(orgBId, userBId, {
      contactId: contactBId,
      type: "BUYER",
      title: `Bulk B ${suffix}`,
      temperature: "COLD",
    })

    const result = await bulkUpdateOpportunities(orgAId, userAId, [oppA.id, oppB.id], {
      temperature: "HOT",
    })
    expect(result.count).toBe(1)

    const refreshedA = await prisma.opportunity.findUniqueOrThrow({ where: { id: oppA.id } })
    const refreshedB = await prisma.opportunity.findUniqueOrThrow({ where: { id: oppB.id } })
    expect(refreshedA.temperature).toBe("HOT")
    expect(refreshedB.temperature).toBe("COLD")
  })

  it("snooze and recurrence stay tenant-scoped", async () => {
    const taskA = await createTask(orgAId, userAId, {
      title: `Recurring ${suffix}`,
      priority: "HIGH",
      dueAt: new Date(),
      recurrenceRule: "WEEKLY",
      contactId: contactAId,
    })
    const until = new Date(Date.now() + 60_000)
    const snoozed = await snoozeTask(orgAId, userAId, taskA.id, until)
    expect(snoozed?.status).toBe("SNOOZED")

    const cross = await snoozeTask(orgBId, userBId, taskA.id, until)
    expect(cross).toBeNull()

    // Force open to complete with recurrence
    await prisma.task.update({
      where: { id: taskA.id },
      data: { status: "OPEN", snoozedUntil: null },
    })
    const done = await completeTask(orgAId, userAId, taskA.id)
    expect(done?.task.status).toBe("COMPLETED")
    expect(done?.nextTask?.organizationId).toBe(orgAId)
    expect(done?.nextTask?.recurrenceRule).toBe("WEEKLY")
    expect(done?.nextTask?.recurrenceParentId).toBe(taskA.id)
  })

  it("workflow enrollments stay tenant-scoped and dedupe ACTIVE", async () => {
    const { createWorkflow } = await import("@/domain/workflows/service")
    const { enrollManually } = await import("@/domain/workflows/engine")

    const wf = await createWorkflow(orgAId, {
      name: `Manual WF ${suffix}`,
      status: "ACTIVE",
      definition: {
        trigger: "MANUAL",
        triggerFilter: {},
        steps: [
          {
            key: "note",
            type: "ACTION_ADD_NOTE",
            body: "Enrolled",
            nextKey: "exit",
          },
          { key: "exit", type: "EXIT" },
        ],
      },
    })

    const first = await enrollManually({
      organizationId: orgAId,
      workflowId: wf.id,
      contactId: contactAId,
      actorUserId: userAId,
    })
    expect(first.organizationId).toBe(orgAId)

    await expect(
      enrollManually({
        organizationId: orgBId,
        workflowId: wf.id,
        contactId: contactAId,
        actorUserId: userBId,
      }),
    ).rejects.toThrow()

    // After complete, re-enroll allowed; while still active would dedupe —
    // first enrollment already completed via EXIT, so second enroll creates new
    const second = await enrollManually({
      organizationId: orgAId,
      workflowId: wf.id,
      contactId: contactAId,
      actorUserId: userAId,
    })
    expect(second.id).not.toBe(first.id)
  })

  it("message templates and mock sends stay tenant-scoped", async () => {
    const { createTemplate, listTemplates, sendEmail } = await import("@/domain/comms/service")

    await prisma.contact.update({
      where: { id: contactAId },
      data: { consentEmail: true, doNotContact: false },
    })

    const tpl = await createTemplate(orgAId, {
      channel: "EMAIL",
      name: `Intro ${suffix}`,
      subject: "Hi {{firstName}}",
      body: "Hello {{firstName}} from {{agentName}}",
    })
    const listB = await listTemplates(orgBId)
    expect(listB.some((t) => t.id === tpl.id)).toBe(false)

    const sent = await sendEmail({
      organizationId: orgAId,
      actorUserId: userAId,
      contactId: contactAId,
      templateId: tpl.id,
      agentName: "Agent A",
    })
    expect(sent.ok).toBe(true)
    if (sent.ok && !sent.skipped) {
      expect(sent.provider).toBe("mock")
    }

    const blocked = await sendEmail({
      organizationId: orgBId,
      actorUserId: userBId,
      contactId: contactAId,
      body: "cross tenant",
      subject: "nope",
    })
    expect(blocked.ok).toBe(false)
  })
})
