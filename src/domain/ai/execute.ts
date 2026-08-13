import type { MembershipRole, Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import { createTask } from "@/domain/tasks/service"
import { addNote } from "@/domain/activities/service"
import { moveOpportunityStage } from "@/domain/opportunities/service"
import { enrollManually } from "@/domain/workflows/engine"
import { sendEmail, sendSms } from "@/domain/comms/service"
import { createContactFact } from "@/domain/ai/assistant"
import {
  canConfirmTool,
  parseToolArgs,
  toolNameSchema,
  type ToolName,
} from "@/domain/ai/tools"

export type ConfirmActionResult =
  | { ok: true; tool: ToolName; resultId: string; message: string }
  | { ok: false; tool?: ToolName; error: string; denied?: boolean }

export async function confirmAssistantAction(input: {
  organizationId: string
  actorUserId: string
  role: MembershipRole
  tool: string
  args: unknown
}): Promise<ConfirmActionResult> {
  const toolParsed = toolNameSchema.safeParse(input.tool)
  if (!toolParsed.success) {
    return { ok: false, error: "Unknown tool" }
  }
  const tool = toolParsed.data

  if (!canConfirmTool(input.role, tool)) {
    await writeAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: "AssistantAction",
      entityId: tool,
      action: "CONFIRM_DENIED",
      after: { tool, role: input.role, reason: "role_forbidden" },
      source: "AI",
    })
    return {
      ok: false,
      tool,
      denied: true,
      error: `Role ${input.role} cannot confirm ${tool}`,
    }
  }

  let args
  try {
    args = parseToolArgs(tool, input.args)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid args"
    await writeAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: "AssistantAction",
      entityId: tool,
      action: "CONFIRM_DENIED",
      after: { tool, reason: "invalid_args", message },
      source: "AI",
    })
    return { ok: false, tool, error: message }
  }

  try {
    const result = await dispatchTool({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      tool,
      args,
    })

    await writeAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: "AssistantAction",
      entityId: result.resultId,
      action: "CONFIRM_EXECUTE",
      after: {
        tool,
        args: args as Prisma.InputJsonValue,
        resultId: result.resultId,
        message: result.message,
      },
      source: "AI",
    })

    return { ok: true, tool, resultId: result.resultId, message: result.message }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed"
    await writeAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: "AssistantAction",
      entityId: tool,
      action: "CONFIRM_DENIED",
      after: { tool, reason: "execute_error", message },
      source: "AI",
    })
    return { ok: false, tool, error: message }
  }
}

async function dispatchTool(input: {
  organizationId: string
  actorUserId: string
  tool: ToolName
  args: unknown
}): Promise<{ resultId: string; message: string }> {
  const { organizationId, actorUserId, tool } = input

  switch (tool) {
    case "create_task": {
      const args = parseToolArgs("create_task", input.args)
      if (args.contactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: args.contactId, organizationId },
        })
        if (!contact) throw new Error("Contact not found in organization")
      }
      const task = await createTask(organizationId, actorUserId, {
        title: args.title,
        contactId: args.contactId ?? null,
        dueAt: args.dueAt ? new Date(args.dueAt) : null,
        priority: args.priority ?? "MEDIUM",
        description: args.description ?? null,
      })
      return { resultId: task.id, message: `Task created: ${task.title}` }
    }
    case "add_note": {
      const args = parseToolArgs("add_note", input.args)
      const note = await addNote(organizationId, actorUserId, {
        contactId: args.contactId,
        body: args.body,
        subject: args.subject ?? undefined,
      })
      return { resultId: note.id, message: "Note added" }
    }
    case "save_contact_fact": {
      const args = parseToolArgs("save_contact_fact", input.args)
      const fact = await createContactFact({
        organizationId,
        actorUserId,
        contactId: args.contactId,
        statement: args.statement,
        fromAi: true,
      })
      if (!fact) throw new Error("Contact not found in organization")
      return { resultId: fact.id, message: "ContactFact saved" }
    }
    case "move_opportunity_stage": {
      const args = parseToolArgs("move_opportunity_stage", input.args)
      const updated = await moveOpportunityStage(
        organizationId,
        actorUserId,
        args.opportunityId,
        args.pipelineStageId,
      )
      if (!updated) throw new Error("Opportunity not found in organization")
      return {
        resultId: updated.id,
        message: `Stage moved to ${updated.pipelineStage.name}`,
      }
    }
    case "enroll_workflow": {
      const args = parseToolArgs("enroll_workflow", input.args)
      if (args.contactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: args.contactId, organizationId },
        })
        if (!contact) throw new Error("Contact not found in organization")
      }
      if (args.opportunityId) {
        const opp = await prisma.opportunity.findFirst({
          where: { id: args.opportunityId, organizationId },
        })
        if (!opp) throw new Error("Opportunity not found in organization")
      }
      const enrollment = await enrollManually({
        organizationId,
        workflowId: args.workflowId,
        contactId: args.contactId ?? null,
        opportunityId: args.opportunityId ?? null,
        actorUserId,
      })
      return { resultId: enrollment.id, message: "Workflow enrolled" }
    }
    case "send_email": {
      const args = parseToolArgs("send_email", input.args)
      const result = await sendEmail({
        organizationId,
        actorUserId,
        contactId: args.contactId,
        subject: args.subject ?? null,
        body: args.body ?? null,
        templateId: args.templateId ?? null,
        source: "AI",
      })
      if (!result.ok) throw new Error(result.error ?? "Email send failed")
      if (result.skipped) {
        return {
          resultId: args.contactId,
          message: `Email skipped: ${result.reason ?? "blocked"}`,
        }
      }
      return {
        resultId: result.messageId,
        message: "Email sent",
      }
    }
    case "send_sms": {
      const args = parseToolArgs("send_sms", input.args)
      const result = await sendSms({
        organizationId,
        actorUserId,
        contactId: args.contactId,
        body: args.body ?? null,
        templateId: args.templateId ?? null,
        source: "AI",
      })
      if (!result.ok) throw new Error(result.error ?? "SMS send failed")
      if (result.skipped) {
        return {
          resultId: args.contactId,
          message: `SMS skipped: ${result.reason ?? "blocked"}`,
        }
      }
      return {
        resultId: result.messageId,
        message: "SMS sent",
      }
    }
    default: {
      const _exhaustive: never = tool
      throw new Error(`Unhandled tool: ${_exhaustive}`)
    }
  }
}
