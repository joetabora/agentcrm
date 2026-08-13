import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import { addHours } from "date-fns"
import {
  findStep,
  parseWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowStep,
  type WorkflowTrigger,
} from "@/domain/workflows/definition"
import {
  matchesWorkflowConditions,
  type WorkflowMatchContext,
} from "@/domain/workflows/conditions"

export type WorkflowEventPayload = {
  organizationId: string
  trigger: WorkflowTrigger
  contactId?: string | null
  opportunityId?: string | null
  actorUserId?: string | null
  context?: WorkflowMatchContext
}

async function loadMatchContext(
  organizationId: string,
  opportunityId?: string | null,
  fallback?: WorkflowMatchContext,
): Promise<WorkflowMatchContext> {
  if (!opportunityId) return fallback ?? {}
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
    include: { pipelineStage: true },
  })
  if (!opp) return fallback ?? {}
  return {
    type: opp.type,
    temperature: opp.temperature,
    stageKey: opp.pipelineStage.key,
    source: opp.source,
    ...fallback,
  }
}

/**
 * Fire-and-forget safe: never throws to callers.
 * Enrolls into each matching ACTIVE workflow (independently).
 */
export async function dispatchWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { organizationId: event.organizationId, status: "ACTIVE" },
    })

    const ctx = await loadMatchContext(
      event.organizationId,
      event.opportunityId,
      event.context,
    )

    for (const workflow of workflows) {
      let definition: WorkflowDefinition
      try {
        definition = parseWorkflowDefinition(workflow.definition)
      } catch {
        continue
      }
      if (definition.trigger !== event.trigger) continue
      if (!matchesWorkflowConditions(definition.triggerFilter, ctx)) continue

      await enrollAndStart({
        organizationId: event.organizationId,
        workflowId: workflow.id,
        definition,
        contactId: event.contactId ?? null,
        opportunityId: event.opportunityId ?? null,
        actorUserId: event.actorUserId ?? null,
        context: ctx,
      })
    }
  } catch (err) {
    console.error("[workflows] dispatch failed", err)
  }
}

export async function enrollManually(input: {
  organizationId: string
  workflowId: string
  contactId?: string | null
  opportunityId?: string | null
  actorUserId?: string | null
}) {
  const workflow = await prisma.workflow.findFirst({
    where: {
      id: input.workflowId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
  })
  if (!workflow) throw new Error("Active workflow not found")

  const definition = parseWorkflowDefinition(workflow.definition)
  if (definition.trigger !== "MANUAL") {
    throw new Error("Workflow is not a MANUAL trigger")
  }

  const ctx = await loadMatchContext(input.organizationId, input.opportunityId)
  if (!matchesWorkflowConditions(definition.triggerFilter, ctx)) {
    throw new Error("Subject does not match workflow filter")
  }

  return enrollAndStart({
    organizationId: input.organizationId,
    workflowId: workflow.id,
    definition,
    contactId: input.contactId ?? null,
    opportunityId: input.opportunityId ?? null,
    actorUserId: input.actorUserId ?? null,
    context: ctx,
  })
}

async function enrollAndStart(input: {
  organizationId: string
  workflowId: string
  definition: WorkflowDefinition
  contactId: string | null
  opportunityId: string | null
  actorUserId: string | null
  context: WorkflowMatchContext
}) {
  const existingWhere = input.opportunityId
    ? {
        organizationId: input.organizationId,
        workflowId: input.workflowId,
        opportunityId: input.opportunityId,
        status: "ACTIVE" as const,
      }
    : {
        organizationId: input.organizationId,
        workflowId: input.workflowId,
        contactId: input.contactId ?? undefined,
        opportunityId: null,
        status: "ACTIVE" as const,
      }

  const existing = await prisma.workflowEnrollment.findFirst({
    where: existingWhere,
  })
  if (existing) return existing

  const first = input.definition.steps[0]
  const enrollment = await prisma.workflowEnrollment.create({
    data: {
      organizationId: input.organizationId,
      workflowId: input.workflowId,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      status: "ACTIVE",
      currentStepKey: first?.key ?? null,
      nextRunAt: null,
      lastError: null,
    },
  })

  await writeAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "WorkflowEnrollment",
    entityId: enrollment.id,
    action: "ENROLL",
    after: { workflowId: input.workflowId, step: enrollment.currentStepKey },
    source: "WORKFLOW",
  })

  await advanceEnrollment(enrollment.id, {
    actorUserId: input.actorUserId,
    context: input.context,
  })

  return enrollment
}

export async function advanceEnrollment(
  enrollmentId: string,
  options?: { actorUserId?: string | null; context?: WorkflowMatchContext; resumeFromDelay?: boolean },
) {
  const enrollment = await prisma.workflowEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { workflow: true },
  })
  if (!enrollment || enrollment.status !== "ACTIVE") return null

  let definition: WorkflowDefinition
  try {
    definition = parseWorkflowDefinition(enrollment.workflow.definition)
  } catch (err) {
    await markError(enrollment.id, err instanceof Error ? err.message : "Invalid definition")
    return null
  }

  if (
    enrollment.nextRunAt &&
    enrollment.nextRunAt > new Date() &&
    !options?.resumeFromDelay
  ) {
    return enrollment
  }

  const ctx =
    options?.context ??
    (await loadMatchContext(enrollment.organizationId, enrollment.opportunityId))

  let stepKey = enrollment.currentStepKey
  let guard = 0

  while (guard++ < 50) {
    const step = findStep(definition, stepKey)
    if (!step) {
      await completeEnrollment(enrollment.id)
      return null
    }

    try {
      const result = await executeStep({
        enrollment,
        step,
        definition,
        context: ctx,
        actorUserId: options?.actorUserId ?? null,
      })

      if (result.kind === "wait") {
        await prisma.workflowEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStepKey: result.nextKey,
            nextRunAt: result.nextRunAt,
            lastError: null,
          },
        })
        return prisma.workflowEnrollment.findUnique({ where: { id: enrollment.id } })
      }

      if (result.kind === "exit") {
        await completeEnrollment(enrollment.id)
        return null
      }

      if (!result.nextKey) {
        await completeEnrollment(enrollment.id)
        return null
      }

      stepKey = result.nextKey
      await prisma.workflowEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepKey: stepKey,
          nextRunAt: null,
          lastError: null,
        },
      })
    } catch (err) {
      await markError(enrollment.id, err instanceof Error ? err.message : "Step failed")
      return null
    }
  }

  await markError(enrollment.id, "Max step iterations exceeded")
  return null
}

type StepResult =
  | { kind: "continue"; nextKey: string | null }
  | { kind: "wait"; nextKey: string; nextRunAt: Date }
  | { kind: "exit" }

async function executeStep(input: {
  enrollment: {
    id: string
    organizationId: string
    contactId: string | null
    opportunityId: string | null
    workflowId: string
  }
  step: WorkflowStep
  definition: WorkflowDefinition
  context: WorkflowMatchContext
  actorUserId: string | null
}): Promise<StepResult> {
  const { enrollment, step, context, actorUserId } = input
  const orgId = enrollment.organizationId

  switch (step.type) {
    case "EXIT":
      return { kind: "exit" }

    case "DELAY":
      return {
        kind: "wait",
        nextKey: step.nextKey,
        nextRunAt: addHours(new Date(), step.waitHours),
      }

    case "CONDITION":
    case "BRANCH": {
      const ok = matchesWorkflowConditions(step.conditions, context)
      return { kind: "continue", nextKey: ok ? step.nextKey : step.elseKey }
    }

    case "ACTION_CREATE_TASK": {
      const dueAt =
        step.dueInHours != null ? addHours(new Date(), step.dueInHours) : null
      const task = await prisma.task.create({
        data: {
          organizationId: orgId,
          title: `[Workflow] ${step.title}`,
          priority: step.priority,
          dueAt,
          contactId: enrollment.contactId,
          opportunityId: enrollment.opportunityId,
          assigneeUserId: actorUserId,
          status: "OPEN",
        },
      })
      await prisma.activity.create({
        data: {
          organizationId: orgId,
          contactId: enrollment.contactId,
          opportunityId: enrollment.opportunityId,
          actorUserId,
          type: "TASK",
          subject: "Workflow created task",
          body: task.title,
        },
      })
      await writeAuditLog({
        organizationId: orgId,
        actorUserId,
        entityType: "Task",
        entityId: task.id,
        action: "CREATE",
        after: { title: task.title, enrollmentId: enrollment.id },
        source: "WORKFLOW",
      })
      return { kind: "continue", nextKey: step.nextKey ?? null }
    }

    case "ACTION_MOVE_STAGE": {
      if (!enrollment.opportunityId) {
        throw new Error("MOVE_STAGE requires opportunity")
      }
      const opp = await prisma.opportunity.findFirst({
        where: { id: enrollment.opportunityId, organizationId: orgId },
        include: { pipeline: { include: { stages: true } }, pipelineStage: true },
      })
      if (!opp) throw new Error("Opportunity not found")
      const stage = opp.pipeline.stages.find((s) => s.key === step.stageKey)
      if (!stage) throw new Error(`Stage key not found: ${step.stageKey}`)

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { pipelineStageId: stage.id },
      })
      await prisma.activity.create({
        data: {
          organizationId: orgId,
          contactId: enrollment.contactId ?? opp.contactId,
          opportunityId: opp.id,
          actorUserId,
          type: "STATUS_CHANGE",
          subject: "Workflow moved stage",
          body: `${opp.pipelineStage.name} → ${stage.name}`,
        },
      })
      await writeAuditLog({
        organizationId: orgId,
        actorUserId,
        entityType: "Opportunity",
        entityId: opp.id,
        action: "STAGE_CHANGE",
        before: { stageId: opp.pipelineStageId },
        after: { stageId: stage.id, enrollmentId: enrollment.id },
        source: "WORKFLOW",
      })
      context.stageKey = stage.key
      return { kind: "continue", nextKey: step.nextKey ?? null }
    }

    case "ACTION_ADD_NOTE": {
      await prisma.activity.create({
        data: {
          organizationId: orgId,
          contactId: enrollment.contactId,
          opportunityId: enrollment.opportunityId,
          actorUserId,
          type: "NOTE",
          subject: "Workflow note",
          body: `[Workflow] ${step.body}`,
        },
      })
      await writeAuditLog({
        organizationId: orgId,
        actorUserId,
        entityType: "WorkflowEnrollment",
        entityId: enrollment.id,
        action: "ADD_NOTE",
        after: { body: step.body },
        source: "WORKFLOW",
      })
      return { kind: "continue", nextKey: step.nextKey ?? null }
    }

    case "ACTION_ASSIGN": {
      if (!enrollment.opportunityId) {
        throw new Error("ASSIGN requires opportunity")
      }
      const opp = await prisma.opportunity.findFirst({
        where: { id: enrollment.opportunityId, organizationId: orgId },
      })
      if (!opp) throw new Error("Opportunity not found")

      const member = await prisma.membership.findFirst({
        where: { organizationId: orgId, userId: step.userId },
      })
      if (!member) throw new Error("Assignee is not an org member")

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { assignedToUserId: step.userId },
      })
      await prisma.assignmentEvent.create({
        data: {
          organizationId: orgId,
          opportunityId: opp.id,
          fromUserId: opp.assignedToUserId,
          toUserId: step.userId,
          actorUserId,
          reason: "Workflow assignment",
          source: "WORKFLOW",
        },
      })
      await writeAuditLog({
        organizationId: orgId,
        actorUserId,
        entityType: "Opportunity",
        entityId: opp.id,
        action: "ASSIGN",
        before: { assignedToUserId: opp.assignedToUserId },
        after: { assignedToUserId: step.userId, enrollmentId: enrollment.id },
        source: "WORKFLOW",
      })
      return { kind: "continue", nextKey: step.nextKey ?? null }
    }

    case "ACTION_SEND_EMAIL": {
      const contactId =
        enrollment.contactId ??
        (
          await prisma.opportunity.findFirst({
            where: { id: enrollment.opportunityId ?? "", organizationId: orgId },
            select: { contactId: true },
          })
        )?.contactId
      if (!contactId) throw new Error("SEND_EMAIL requires contact")
      const { sendEmail } = await import("@/domain/comms/service")
      const result = await sendEmail({
        organizationId: orgId,
        actorUserId,
        contactId,
        subject: step.subject,
        body: step.body,
        templateId: step.templateId,
        source: "WORKFLOW",
        skipOnBlock: true,
      })
      if (!result.ok) {
        throw new Error(result.error)
      }
      return { kind: "continue", nextKey: step.nextKey ?? null }
    }

    case "ACTION_SEND_SMS": {
      const contactId =
        enrollment.contactId ??
        (
          await prisma.opportunity.findFirst({
            where: { id: enrollment.opportunityId ?? "", organizationId: orgId },
            select: { contactId: true },
          })
        )?.contactId
      if (!contactId) throw new Error("SEND_SMS requires contact")
      const { sendSms } = await import("@/domain/comms/service")
      const result = await sendSms({
        organizationId: orgId,
        actorUserId,
        contactId,
        body: step.body,
        templateId: step.templateId,
        source: "WORKFLOW",
        skipOnBlock: true,
      })
      if (!result.ok) {
        throw new Error(result.error)
      }
      return { kind: "continue", nextKey: step.nextKey ?? null }
    }

    default:
      throw new Error("Unknown step type")
  }
}

async function completeEnrollment(enrollmentId: string) {
  await prisma.workflowEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "COMPLETED",
      exitedAt: new Date(),
      nextRunAt: null,
      lastError: null,
    },
  })
}

async function markError(enrollmentId: string, message: string) {
  await prisma.workflowEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "ERROR",
      lastError: message.slice(0, 2000),
      exitedAt: new Date(),
    },
  })
}

export async function processDueEnrollments(organizationId?: string) {
  const now = new Date()
  const due = await prisma.workflowEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      ...(organizationId ? { organizationId } : {}),
    },
    take: 100,
    orderBy: { nextRunAt: "asc" },
  })

  let processed = 0
  for (const enrollment of due) {
    await advanceEnrollment(enrollment.id, { resumeFromDelay: true })
    processed++
  }
  return { processed }
}

/** Test helper: pure next-step resolution for DELAY without DB. */
export function previewDelayNextRun(waitHours: number, now = new Date()) {
  return addHours(now, waitHours)
}
