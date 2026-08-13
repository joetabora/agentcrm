import { z } from "zod"

export const workflowTriggerSchema = z.enum([
  "OPPORTUNITY_CREATED",
  "STAGE_CHANGED",
  "TASK_COMPLETED",
  "MANUAL",
])

export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>

export const workflowConditionsSchema = z.object({
  type: z.enum(["BUYER", "SELLER"]).optional(),
  temperature: z.enum(["COLD", "WARM", "HOT"]).optional(),
  stageKey: z.string().optional(),
  sourceContains: z.string().optional(),
})

export type WorkflowConditions = z.infer<typeof workflowConditionsSchema>

const baseStep = z.object({
  key: z.string().min(1).max(80),
})

export const workflowStepSchema = z.discriminatedUnion("type", [
  baseStep.extend({
    type: z.literal("CONDITION"),
    conditions: workflowConditionsSchema.default({}),
    nextKey: z.string().min(1),
    elseKey: z.string().min(1),
  }),
  baseStep.extend({
    type: z.literal("BRANCH"),
    conditions: workflowConditionsSchema.default({}),
    nextKey: z.string().min(1),
    elseKey: z.string().min(1),
  }),
  baseStep.extend({
    type: z.literal("ACTION_CREATE_TASK"),
    title: z.string().min(1).max(300),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
    dueInHours: z.number().int().nonnegative().optional(),
    nextKey: z.string().optional().nullable(),
  }),
  baseStep.extend({
    type: z.literal("ACTION_MOVE_STAGE"),
    stageKey: z.string().min(1),
    nextKey: z.string().optional().nullable(),
  }),
  baseStep.extend({
    type: z.literal("ACTION_ADD_NOTE"),
    body: z.string().min(1).max(5000),
    nextKey: z.string().optional().nullable(),
  }),
  baseStep.extend({
    type: z.literal("ACTION_ASSIGN"),
    userId: z.string().min(1),
    nextKey: z.string().optional().nullable(),
  }),
  baseStep.extend({
    type: z.literal("ACTION_SEND_EMAIL"),
    subject: z.string().max(300).optional().nullable(),
    body: z.string().max(10000).optional().nullable(),
    templateId: z.string().optional().nullable(),
    nextKey: z.string().optional().nullable(),
  }),
  baseStep.extend({
    type: z.literal("ACTION_SEND_SMS"),
    body: z.string().max(1600).optional().nullable(),
    templateId: z.string().optional().nullable(),
    nextKey: z.string().optional().nullable(),
  }),
  baseStep.extend({
    type: z.literal("DELAY"),
    waitHours: z.number().int().positive().max(24 * 365),
    nextKey: z.string().min(1),
  }),
  baseStep.extend({
    type: z.literal("EXIT"),
  }),
])

export type WorkflowStep = z.infer<typeof workflowStepSchema>

export const workflowDefinitionSchema = z.object({
  trigger: workflowTriggerSchema,
  triggerFilter: workflowConditionsSchema.optional().default({}),
  steps: z.array(workflowStepSchema).min(1),
})

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>

export function parseWorkflowDefinition(raw: unknown): WorkflowDefinition {
  return workflowDefinitionSchema.parse(raw)
}

export function safeParseWorkflowDefinition(raw: unknown) {
  return workflowDefinitionSchema.safeParse(raw)
}

export function findStep(definition: WorkflowDefinition, key: string | null | undefined) {
  if (!key) return definition.steps[0] ?? null
  return definition.steps.find((s) => s.key === key) ?? null
}
