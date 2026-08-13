import type { LeadTemperature, OpportunityType } from "@/generated/prisma/client"
import type { WorkflowConditions } from "@/domain/workflows/definition"

export type WorkflowMatchContext = {
  type?: OpportunityType | null
  temperature?: LeadTemperature | null
  stageKey?: string | null
  source?: string | null
}

export function matchesWorkflowConditions(
  conditions: WorkflowConditions | undefined | null,
  ctx: WorkflowMatchContext,
): boolean {
  if (!conditions) return true
  if (conditions.type && conditions.type !== ctx.type) return false
  if (conditions.temperature && conditions.temperature !== ctx.temperature) return false
  if (conditions.stageKey && conditions.stageKey !== ctx.stageKey) return false
  if (conditions.sourceContains) {
    const hay = (ctx.source ?? "").toLowerCase()
    if (!hay.includes(conditions.sourceContains.toLowerCase())) return false
  }
  return true
}
