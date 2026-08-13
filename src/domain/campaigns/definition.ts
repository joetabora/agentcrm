import { z } from "zod"

export const MAX_CAMPAIGN_STEPS = 8
export const MAX_CAMPAIGN_ENROLLMENTS = 200

const baseStep = z.object({
  key: z.string().min(1).max(80),
})

export const campaignStepSchema = z.discriminatedUnion("type", [
  baseStep.extend({
    type: z.literal("SEND_EMAIL"),
    subject: z.string().max(300).optional().nullable(),
    body: z.string().max(10000).optional().nullable(),
    templateId: z.string().optional().nullable(),
    nextKey: z.string().min(1).optional().nullable(),
  }),
  baseStep.extend({
    type: z.literal("SEND_SMS"),
    body: z.string().max(1600).optional().nullable(),
    templateId: z.string().optional().nullable(),
    nextKey: z.string().min(1).optional().nullable(),
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

export type CampaignStep = z.infer<typeof campaignStepSchema>

export const campaignDefinitionSchema = z.object({
  entryKey: z.string().min(1),
  steps: z.array(campaignStepSchema).min(1).max(MAX_CAMPAIGN_STEPS),
})

export type CampaignDefinition = z.infer<typeof campaignDefinitionSchema>

export const campaignAudienceSchema = z.object({
  contactType: z
    .enum([
      "LEAD",
      "BUYER",
      "SELLER",
      "PAST_CLIENT",
      "SPHERE",
      "VENDOR",
      "AGENT",
      "LENDER",
      "ATTORNEY",
      "TITLE",
      "INVESTOR",
      "OTHER",
    ])
    .optional()
    .nullable(),
  lifecycleStage: z
    .enum([
      "NEW",
      "CONTACTED",
      "ENGAGED",
      "QUALIFIED",
      "APPOINTMENT",
      "ACTIVE_CLIENT",
      "UNDER_CONTRACT",
      "CLOSED",
      "PAST_CLIENT",
      "NURTURE",
      "LOST",
    ])
    .optional()
    .nullable(),
  temperature: z.enum(["COLD", "WARM", "HOT"]).optional().nullable(),
  sourceContains: z.string().max(120).optional().nullable(),
  tagName: z.string().max(80).optional().nullable(),
  requireConsent: z.literal(true).default(true),
})

export type CampaignAudience = z.infer<typeof campaignAudienceSchema>

export function parseCampaignDefinition(raw: unknown): CampaignDefinition {
  return campaignDefinitionSchema.parse(raw)
}

export function parseCampaignAudience(raw: unknown): CampaignAudience {
  return campaignAudienceSchema.parse(raw ?? { requireConsent: true })
}

export function getStepMap(definition: CampaignDefinition) {
  return new Map(definition.steps.map((s) => [s.key, s]))
}
