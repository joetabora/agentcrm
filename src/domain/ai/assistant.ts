import { z } from "zod"
import { writeAuditLog } from "@/server/audit"
import { getAIProvider } from "@/providers/ai"
import { buildCrmContext } from "@/domain/ai/context"
import { prisma } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"

export const claimKindSchema = z.enum(["FACT", "CALCULATION", "INFERENCE", "UNKNOWN"])

export const assistantClaimSchema = z.object({
  text: z.string().min(1).max(2000),
  kind: claimKindSchema,
  sourceIds: z.array(z.string()).optional(),
})

export const assistantResponseSchema = z.object({
  answerMarkdown: z.string().max(20000),
  claims: z.array(assistantClaimSchema).default([]),
  refused: z.boolean().optional(),
  refuseReason: z.string().max(1000).optional(),
})

export type AssistantResponse = z.infer<typeof assistantResponseSchema>

const SYSTEM_PROMPT = `You are Joe Real Estate OS assistant. Answer ONLY using the CONTEXT block.
Rules:
- Never invent emails, phone numbers, prices, MLS data, activities, or preferences not in CONTEXT.
- Every claim must be labeled FACT (directly from CONTEXT fields), CALCULATION (deterministic from CONTEXT), INFERENCE (careful guess clearly not verified), or UNKNOWN.
- If CONTEXT is insufficient, set refused=true and refuseReason, and put UNKNOWN claims only.
- Fair Housing: do not reason about race, religion, national origin, sex, disability, familial status, or proxies for those.
- Property answers may only use stored inventory fields from CONTEXT.
- Respond with JSON only matching:
{"answerMarkdown":"string","claims":[{"text":"string","kind":"FACT"|"CALCULATION"|"INFERENCE"|"UNKNOWN","sourceIds":["optional"]}],"refused":false,"refuseReason":"optional"}`

export function parseAssistantResponse(raw: string): AssistantResponse {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      answerMarkdown: "No answer returned.",
      claims: [{ text: "Empty model response", kind: "UNKNOWN" }],
      refused: true,
      refuseReason: "Empty model response",
    }
  }
  try {
    const jsonStart = trimmed.indexOf("{")
    const jsonEnd = trimmed.lastIndexOf("}")
    const slice =
      jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed
    return assistantResponseSchema.parse(JSON.parse(slice))
  } catch {
    return {
      answerMarkdown: "Could not parse a grounded answer. Please try again or inspect CRM records directly.",
      claims: [{ text: "Response failed schema validation", kind: "UNKNOWN" }],
      refused: true,
      refuseReason: "Invalid model JSON",
    }
  }
}

export async function askAssistant(input: {
  organizationId: string
  actorUserId: string
  question: string
  contactId?: string | null
  opportunityId?: string | null
}) {
  const question = input.question.trim()
  if (!question) {
    return {
      response: {
        answerMarkdown: "Please enter a question.",
        claims: [],
        refused: true,
        refuseReason: "Empty question",
      } satisfies AssistantResponse,
      sources: [] as Awaited<ReturnType<typeof buildCrmContext>>["sources"],
      provider: "none",
      model: "none",
      contextEmpty: true,
    }
  }

  const pack = await buildCrmContext({
    organizationId: input.organizationId,
    contactId: input.contactId,
    opportunityId: input.opportunityId,
    q: question,
  })

  if (pack.empty) {
    const response: AssistantResponse = {
      answerMarkdown:
        "I don’t have enough CRM context in your organization to answer. Add contacts, leads, or properties first.",
      claims: [{ text: "No authorized CRM context available", kind: "UNKNOWN" }],
      refused: true,
      refuseReason: "Empty context pack",
    }
    await writeAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: "AssistantQuery",
      entityId: input.contactId ?? input.organizationId,
      action: "ASK",
      after: {
        question,
        refused: true,
        reason: "empty_context",
        sourceIds: [],
      },
      source: "AI",
    })
    return {
      response,
      sources: pack.sources,
      provider: "none",
      model: "none",
      contextEmpty: true,
    }
  }

  const provider = getAIProvider()
  let completion
  try {
    completion = await provider.complete({
      task: "fast",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `CONTEXT:\n${pack.text.slice(0, 24000)}\n\nQUESTION:\n${question}`,
        },
      ],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider error"
    const response: AssistantResponse = {
      answerMarkdown: `AI provider failed: ${message}`,
      claims: [{ text: message, kind: "UNKNOWN" }],
      refused: true,
      refuseReason: message,
    }
    await writeAuditLog({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entityType: "AssistantQuery",
      entityId: input.contactId ?? input.organizationId,
      action: "ASK_ERROR",
      after: { question, error: message },
      source: "AI",
    })
    return {
      response,
      sources: pack.sources,
      provider: provider.name,
      model: "error",
      contextEmpty: false,
    }
  }

  const response = parseAssistantResponse(completion.content)

  await writeAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "AssistantQuery",
    entityId: input.contactId ?? input.organizationId,
    action: "ASK",
    after: {
      question,
      provider: completion.provider,
      model: completion.model,
      refused: response.refused ?? false,
      claimKinds: response.claims.map((c) => c.kind),
      sourceIds: pack.sources.map((s) => s.id),
    } as Prisma.InputJsonValue,
    source: "AI",
  })

  return {
    response,
    sources: pack.sources,
    provider: completion.provider,
    model: completion.model,
    contextEmpty: false,
  }
}

export async function createContactFact(input: {
  organizationId: string
  actorUserId: string
  contactId: string
  statement: string
  fromAi?: boolean
}) {
  const statement = input.statement.trim()
  if (!statement) throw new Error("Statement required")

  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, organizationId: input.organizationId },
  })
  if (!contact) return null

  const fact = await prisma.contactFact.create({
    data: {
      organizationId: input.organizationId,
      contactId: input.contactId,
      statement,
      source: input.fromAi ? "AI" : "USER",
      confidence: input.fromAi ? "LOW" : "HIGH",
      provenance: input.fromAi ? "AI_INFERENCE" : "USER_ENTERED",
    },
  })

  await writeAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "ContactFact",
    entityId: fact.id,
    action: "CREATE",
    after: {
      statement: fact.statement,
      source: fact.source,
      provenance: fact.provenance,
    },
    source: input.fromAi ? "AI" : "USER",
  })

  return fact
}
