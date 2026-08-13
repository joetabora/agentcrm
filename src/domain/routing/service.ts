import { prisma } from "@/lib/db"
import type { OpportunityType, LeadTemperature, Prisma } from "@/generated/prisma/client"
import { z } from "zod"

export type RoutingConditions = {
  type?: OpportunityType
  sourceContains?: string
  temperature?: LeadTemperature
  minEstimatedValue?: number
  maxEstimatedValue?: number
}

export const createRoutingRuleSchema = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  position: z.number().int().nonnegative().default(0),
  assignMode: z.enum(["SPECIFIC_USER", "ROUND_ROBIN"]),
  targetUserId: z.string().optional().nullable(),
  roundRobinUserIds: z.array(z.string()).optional(),
  conditions: z.object({
    type: z.enum(["BUYER", "SELLER"]).optional(),
    sourceContains: z.string().optional(),
    temperature: z.enum(["COLD", "WARM", "HOT"]).optional(),
    minEstimatedValue: z.number().optional(),
    maxEstimatedValue: z.number().optional(),
  }),
})

export type CreateRoutingRuleInput = z.infer<typeof createRoutingRuleSchema>

function matchesConditions(
  conditions: RoutingConditions,
  lead: {
    type: OpportunityType
    source: string | null
    temperature: LeadTemperature
    estimatedValue: number | null
  },
): boolean {
  if (conditions.type && conditions.type !== lead.type) return false
  if (conditions.temperature && conditions.temperature !== lead.temperature) return false
  if (conditions.sourceContains) {
    const hay = (lead.source ?? "").toLowerCase()
    if (!hay.includes(conditions.sourceContains.toLowerCase())) return false
  }
  if (
    conditions.minEstimatedValue != null &&
    (lead.estimatedValue == null || lead.estimatedValue < conditions.minEstimatedValue)
  ) {
    return false
  }
  if (
    conditions.maxEstimatedValue != null &&
    (lead.estimatedValue == null || lead.estimatedValue > conditions.maxEstimatedValue)
  ) {
    return false
  }
  return true
}

export async function listRoutingRules(organizationId: string) {
  return prisma.routingRule.findMany({
    where: { organizationId },
    include: { targetUser: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })
}

export async function createRoutingRule(
  organizationId: string,
  input: CreateRoutingRuleInput,
) {
  const data = createRoutingRuleSchema.parse(input)
  if (data.assignMode === "SPECIFIC_USER" && !data.targetUserId) {
    throw new Error("targetUserId required for SPECIFIC_USER mode")
  }
  return prisma.routingRule.create({
    data: {
      organizationId,
      name: data.name,
      enabled: data.enabled,
      position: data.position,
      assignMode: data.assignMode,
      targetUserId: data.targetUserId ?? null,
      roundRobinUserIds: data.roundRobinUserIds ?? [],
      conditions: data.conditions as Prisma.InputJsonValue,
    },
  })
}

export async function updateRoutingRule(
  organizationId: string,
  ruleId: string,
  input: Partial<CreateRoutingRuleInput> & { enabled?: boolean },
) {
  const existing = await prisma.routingRule.findFirst({
    where: { id: ruleId, organizationId },
  })
  if (!existing) return null

  return prisma.routingRule.update({
    where: { id: ruleId },
    data: {
      name: input.name,
      enabled: input.enabled,
      position: input.position,
      assignMode: input.assignMode,
      targetUserId: input.targetUserId === undefined ? undefined : input.targetUserId,
      roundRobinUserIds:
        input.roundRobinUserIds === undefined
          ? undefined
          : (input.roundRobinUserIds as Prisma.InputJsonValue),
      conditions:
        input.conditions === undefined
          ? undefined
          : (input.conditions as Prisma.InputJsonValue),
    },
  })
}

export async function deleteRoutingRule(organizationId: string, ruleId: string) {
  const existing = await prisma.routingRule.findFirst({
    where: { id: ruleId, organizationId },
  })
  if (!existing) return null
  await prisma.routingRule.delete({ where: { id: ruleId } })
  return existing
}

export async function resolveRoutingAssignee(
  organizationId: string,
  lead: {
    type: OpportunityType
    source: string | null
    temperature: LeadTemperature
    estimatedValue: number | null
  },
): Promise<{ userId: string; ruleId: string; ruleName: string } | null> {
  const rules = await prisma.routingRule.findMany({
    where: { organizationId, enabled: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })

  for (const rule of rules) {
    const conditions = (rule.conditions ?? {}) as RoutingConditions
    if (!matchesConditions(conditions, lead)) continue

    if (rule.assignMode === "SPECIFIC_USER" && rule.targetUserId) {
      const member = await prisma.membership.findFirst({
        where: { organizationId, userId: rule.targetUserId },
      })
      if (!member) continue
      return { userId: rule.targetUserId, ruleId: rule.id, ruleName: rule.name }
    }

    if (rule.assignMode === "ROUND_ROBIN") {
      const configured = Array.isArray(rule.roundRobinUserIds)
        ? (rule.roundRobinUserIds as string[])
        : []

      const members = await prisma.membership.findMany({
        where: {
          organizationId,
          role: { in: ["OWNER", "ADMIN", "AGENT"] },
          ...(configured.length ? { userId: { in: configured } } : {}),
        },
        orderBy: { createdAt: "asc" },
      })
      if (members.length === 0) continue

      const index = rule.roundRobinIndex % members.length
      const userId = members[index].userId
      await prisma.routingRule.update({
        where: { id: rule.id },
        data: { roundRobinIndex: index + 1 },
      })
      return { userId, ruleId: rule.id, ruleName: rule.name }
    }
  }

  return null
}

/** Pure helper for unit tests */
export function routingRuleMatches(
  conditions: RoutingConditions,
  lead: {
    type: OpportunityType
    source: string | null
    temperature: LeadTemperature
    estimatedValue: number | null
  },
) {
  return matchesConditions(conditions, lead)
}
