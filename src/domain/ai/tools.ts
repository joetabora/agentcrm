import { z } from "zod"
import type { MembershipRole } from "@/generated/prisma/client"

export const TOOL_NAMES = [
  "create_task",
  "add_note",
  "save_contact_fact",
  "move_opportunity_stage",
  "enroll_workflow",
  "send_email",
  "send_sms",
] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export const toolRiskSchema = z.enum(["low", "high"])
export type ToolRisk = z.infer<typeof toolRiskSchema>

export const toolNameSchema = z.enum(TOOL_NAMES)

export const createTaskArgsSchema = z.object({
  title: z.string().min(1).max(300),
  contactId: z.string().min(1).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  description: z.string().max(5000).optional().nullable(),
})

export const addNoteArgsSchema = z.object({
  contactId: z.string().min(1),
  body: z.string().min(1).max(10000),
  subject: z.string().max(200).optional().nullable(),
})

export const saveContactFactArgsSchema = z.object({
  contactId: z.string().min(1),
  statement: z.string().min(1).max(2000),
})

export const moveOpportunityStageArgsSchema = z.object({
  opportunityId: z.string().min(1),
  pipelineStageId: z.string().min(1),
})

export const enrollWorkflowArgsSchema = z
  .object({
    workflowId: z.string().min(1),
    contactId: z.string().min(1).optional().nullable(),
    opportunityId: z.string().min(1).optional().nullable(),
  })
  .refine((v) => Boolean(v.contactId || v.opportunityId), {
    message: "contactId or opportunityId required",
  })

export const sendEmailArgsSchema = z
  .object({
    contactId: z.string().min(1),
    subject: z.string().max(300).optional().nullable(),
    body: z.string().max(10000).optional().nullable(),
    templateId: z.string().min(1).optional().nullable(),
  })
  .refine((v) => Boolean(v.templateId || (v.body && v.body.trim())), {
    message: "body or templateId required",
  })

export const sendSmsArgsSchema = z
  .object({
    contactId: z.string().min(1),
    body: z.string().max(1600).optional().nullable(),
    templateId: z.string().min(1).optional().nullable(),
  })
  .refine((v) => Boolean(v.templateId || (v.body && v.body.trim())), {
    message: "body or templateId required",
  })

export const toolArgsSchemas = {
  create_task: createTaskArgsSchema,
  add_note: addNoteArgsSchema,
  save_contact_fact: saveContactFactArgsSchema,
  move_opportunity_stage: moveOpportunityStageArgsSchema,
  enroll_workflow: enrollWorkflowArgsSchema,
  send_email: sendEmailArgsSchema,
  send_sms: sendSmsArgsSchema,
} as const

export function riskForTool(tool: ToolName): ToolRisk {
  switch (tool) {
    case "create_task":
    case "add_note":
    case "save_contact_fact":
      return "low"
    default:
      return "high"
  }
}

const ASSISTANT_ALLOWED: ReadonlySet<ToolName> = new Set([
  "create_task",
  "add_note",
  "save_contact_fact",
])

export function canConfirmTool(role: MembershipRole, tool: ToolName): boolean {
  if (role === "OWNER" || role === "ADMIN" || role === "AGENT") return true
  if (role === "ASSISTANT") return ASSISTANT_ALLOWED.has(tool)
  return false
}

export const proposedActionSchema = z.object({
  id: z.string().min(1).max(64),
  tool: toolNameSchema,
  args: z.record(z.string(), z.unknown()),
  rationale: z.string().max(1000).default(""),
  risk: toolRiskSchema.optional(),
})

export type ProposedAction = z.infer<typeof proposedActionSchema>

export function normalizeProposedAction(raw: ProposedAction): ProposedAction {
  return {
    ...raw,
    risk: riskForTool(raw.tool),
  }
}

export function parseToolArgs<T extends ToolName>(
  tool: T,
  args: unknown,
): z.infer<(typeof toolArgsSchemas)[T]> {
  return toolArgsSchemas[tool].parse(args) as z.infer<(typeof toolArgsSchemas)[T]>
}

export function toolCatalogForPrompt(): string {
  return [
    "Available tools (PROPOSE ONLY — never claim executed). Human must confirm.",
    "- create_task: {title, contactId?, dueAt? ISO, priority? LOW|MEDIUM|HIGH|URGENT, description?}",
    "- add_note: {contactId, body, subject?}",
    "- save_contact_fact: {contactId, statement}",
    "- move_opportunity_stage: {opportunityId, pipelineStageId} — ids must appear in CONTEXT",
    "- enroll_workflow: {workflowId, contactId? or opportunityId?} — workflowId must appear in CONTEXT",
    "- send_email: {contactId, subject?, body?} or {contactId, templateId}",
    "- send_sms: {contactId, body?} or {contactId, templateId}",
    "Only propose when CONTEXT contains required entity ids. Never invent ids.",
  ].join("\n")
}
