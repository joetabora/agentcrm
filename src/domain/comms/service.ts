import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type { AuditSource, CommChannel, Prisma } from "@/generated/prisma/client"
import { z } from "zod"
import { assertCanSend, buildMergeVars, renderTemplate } from "@/domain/comms/consent"
import { getEmailFromAddress, getEmailProvider } from "@/providers/email"
import { getSmsFromNumber, getSmsProvider } from "@/providers/sms"

export const createTemplateSchema = z.object({
  channel: z.enum(["EMAIL", "SMS"]),
  name: z.string().min(1).max(120),
  subject: z.string().max(300).optional().nullable(),
  body: z.string().min(1).max(10000),
})

export type CreateTemplateInput = z.input<typeof createTemplateSchema>

export async function listTemplates(organizationId: string, channel?: CommChannel) {
  return prisma.messageTemplate.findMany({
    where: {
      organizationId,
      ...(channel ? { channel } : {}),
    },
    orderBy: { name: "asc" },
  })
}

export async function createTemplate(organizationId: string, input: CreateTemplateInput) {
  const data = createTemplateSchema.parse(input)
  return prisma.messageTemplate.create({
    data: {
      organizationId,
      channel: data.channel,
      name: data.name,
      subject: data.subject ?? null,
      body: data.body,
    },
  })
}

export async function deleteTemplate(organizationId: string, templateId: string) {
  const existing = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
  })
  if (!existing) return null
  await prisma.messageTemplate.delete({ where: { id: templateId } })
  return existing
}

export async function listThreadsForContact(organizationId: string, contactId: string) {
  return prisma.communicationThread.findMany({
    where: { organizationId, contactId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
    orderBy: { lastMessageAt: "desc" },
  })
}

async function getOrCreateThread(input: {
  organizationId: string
  contactId: string
  channel: CommChannel
  subject?: string | null
}) {
  const existing = await prisma.communicationThread.findFirst({
    where: {
      organizationId: input.organizationId,
      contactId: input.contactId,
      channel: input.channel,
    },
    orderBy: { updatedAt: "desc" },
  })
  if (existing) return existing
  return prisma.communicationThread.create({
    data: {
      organizationId: input.organizationId,
      contactId: input.contactId,
      channel: input.channel,
      subject: input.subject ?? null,
    },
  })
}

export type SendResult =
  | { ok: true; messageId: string; provider: string; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string }

export async function sendEmail(input: {
  organizationId: string
  actorUserId: string | null
  contactId: string
  subject?: string | null
  body?: string | null
  templateId?: string | null
  source?: AuditSource
  skipOnBlock?: boolean
  agentName?: string
}): Promise<SendResult> {
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, organizationId: input.organizationId },
    include: { emails: true, organization: true, phones: true },
  })
  if (!contact) return { ok: false, error: "Contact not found" }

  const decision = assertCanSend(contact, "EMAIL")
  if (!decision.allowed) {
    if (input.skipOnBlock) {
      await prisma.activity.create({
        data: {
          organizationId: input.organizationId,
          contactId: contact.id,
          actorUserId: input.actorUserId,
          type: "SYSTEM",
          subject: "Email skipped",
          body: decision.reason,
        },
      })
      return { ok: true, skipped: true, reason: decision.reason }
    }
    return { ok: false, error: decision.reason }
  }

  const primary = contact.emails.find((e) => e.isPrimary) ?? contact.emails[0]
  if (!primary) return { ok: false, error: "Contact has no email address" }
  const primaryPhone = contact.phones.find((p) => p.isPrimary) ?? contact.phones[0]

  let subject = input.subject ?? ""
  let body = input.body ?? ""
  const templateId = input.templateId ?? null
  const vars = buildMergeVars({
    firstName: contact.firstName,
    lastName: contact.lastName,
    preferredName: contact.preferredName,
    email: primary.email,
    phone: primaryPhone?.phone,
    agentName: input.agentName,
    organizationName: contact.organization.name,
  })
  if (templateId) {
    const tpl = await prisma.messageTemplate.findFirst({
      where: { id: templateId, organizationId: input.organizationId, channel: "EMAIL" },
    })
    if (!tpl) return { ok: false, error: "Template not found" }
    subject = renderTemplate(tpl.subject ?? (subject || "Message"), vars)
    body = renderTemplate(tpl.body, vars)
  } else {
    subject = renderTemplate(subject || "Message", vars)
    body = renderTemplate(body, vars)
  }

  if (!body.trim()) return { ok: false, error: "Email body is empty" }

  const thread = await getOrCreateThread({
    organizationId: input.organizationId,
    contactId: contact.id,
    channel: "EMAIL",
    subject,
  })

  const provider = getEmailProvider()
  const from = getEmailFromAddress()
  let providerId: string
  try {
    const result = await provider.send({
      to: primary.email,
      from,
      subject,
      html: body.includes("<") ? body : `<p>${body.replace(/\n/g, "<br/>")}</p>`,
      text: body.replace(/<[^>]+>/g, ""),
    })
    providerId = result.id
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    await prisma.message.create({
      data: {
        organizationId: input.organizationId,
        threadId: thread.id,
        direction: "OUTBOUND",
        status: "FAILED",
        subject,
        body,
        providerName: provider.name,
        actorUserId: input.actorUserId,
        templateId,
        metadata: { error: message } as Prisma.InputJsonValue,
      },
    })
    return { ok: false, error: message }
  }

  const msg = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      threadId: thread.id,
      direction: "OUTBOUND",
      status: "SENT",
      subject,
      body,
      providerMessageId: providerId,
      providerName: provider.name,
      actorUserId: input.actorUserId,
      templateId,
    },
  })

  await prisma.communicationThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date(), subject },
  })

  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastContactedAt: new Date() },
  })

  await prisma.activity.create({
    data: {
      organizationId: input.organizationId,
      contactId: contact.id,
      actorUserId: input.actorUserId,
      type: "EMAIL",
      subject: `Email: ${subject}`,
      body,
      metadata: { messageId: msg.id, provider: provider.name, providerMessageId: providerId },
    },
  })

  await writeAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "Message",
    entityId: msg.id,
    action: "SEND_EMAIL",
    after: { to: primary.email, provider: provider.name },
    source: input.source ?? "USER",
  })

  return { ok: true, messageId: msg.id, provider: provider.name }
}

export async function sendSms(input: {
  organizationId: string
  actorUserId: string | null
  contactId: string
  body?: string | null
  templateId?: string | null
  source?: AuditSource
  skipOnBlock?: boolean
  agentName?: string
}): Promise<SendResult> {
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, organizationId: input.organizationId },
    include: { phones: true, emails: true, organization: true },
  })
  if (!contact) return { ok: false, error: "Contact not found" }

  const decision = assertCanSend(contact, "SMS")
  if (!decision.allowed) {
    if (input.skipOnBlock) {
      await prisma.activity.create({
        data: {
          organizationId: input.organizationId,
          contactId: contact.id,
          actorUserId: input.actorUserId,
          type: "SYSTEM",
          subject: "SMS skipped",
          body: decision.reason,
        },
      })
      return { ok: true, skipped: true, reason: decision.reason }
    }
    return { ok: false, error: decision.reason }
  }

  const primary = contact.phones.find((p) => p.isPrimary) ?? contact.phones[0]
  if (!primary) return { ok: false, error: "Contact has no phone number" }
  const primaryEmail = contact.emails.find((e) => e.isPrimary) ?? contact.emails[0]

  let body = input.body ?? ""
  const templateId = input.templateId ?? null
  const vars = buildMergeVars({
    firstName: contact.firstName,
    lastName: contact.lastName,
    preferredName: contact.preferredName,
    email: primaryEmail?.email,
    phone: primary.phone,
    agentName: input.agentName,
    organizationName: contact.organization.name,
  })
  if (templateId) {
    const tpl = await prisma.messageTemplate.findFirst({
      where: { id: templateId, organizationId: input.organizationId, channel: "SMS" },
    })
    if (!tpl) return { ok: false, error: "Template not found" }
    body = renderTemplate(tpl.body, vars)
  } else {
    body = renderTemplate(body, vars)
  }
  if (!body.trim()) return { ok: false, error: "SMS body is empty" }

  const thread = await getOrCreateThread({
    organizationId: input.organizationId,
    contactId: contact.id,
    channel: "SMS",
  })

  const provider = getSmsProvider()
  const from = getSmsFromNumber()
  let providerId: string
  try {
    const result = await provider.send({ to: primary.phone, from, body })
    providerId = result.id
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed"
    await prisma.message.create({
      data: {
        organizationId: input.organizationId,
        threadId: thread.id,
        direction: "OUTBOUND",
        status: "FAILED",
        body,
        providerName: provider.name,
        actorUserId: input.actorUserId,
        templateId,
        metadata: { error: message } as Prisma.InputJsonValue,
      },
    })
    return { ok: false, error: message }
  }

  const msg = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      threadId: thread.id,
      direction: "OUTBOUND",
      status: "SENT",
      body,
      providerMessageId: providerId,
      providerName: provider.name,
      actorUserId: input.actorUserId,
      templateId,
    },
  })

  await prisma.communicationThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date() },
  })

  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastContactedAt: new Date() },
  })

  await prisma.activity.create({
    data: {
      organizationId: input.organizationId,
      contactId: contact.id,
      actorUserId: input.actorUserId,
      type: "SMS",
      subject: "SMS sent",
      body,
      metadata: { messageId: msg.id, provider: provider.name, providerMessageId: providerId },
    },
  })

  await writeAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "Message",
    entityId: msg.id,
    action: "SEND_SMS",
    after: { to: primary.phone, provider: provider.name },
    source: input.source ?? "USER",
  })

  return { ok: true, messageId: msg.id, provider: provider.name }
}

const STOP_WORDS = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"])

export function isSmsStopBody(body: string): boolean {
  const token = body.trim().toUpperCase().split(/\s+/)[0] ?? ""
  return STOP_WORDS.has(token)
}

export async function handleInboundSms(input: {
  organizationId: string
  fromPhone: string
  body: string
  providerMessageId?: string
}) {
  const phone = input.fromPhone.trim()
  const contact = await prisma.contact.findFirst({
    where: {
      organizationId: input.organizationId,
      phones: { some: { phone: { contains: phone.replace(/\D/g, "").slice(-10) } } },
    },
  })
  if (!contact) {
    // Try exact match
    const exact = await prisma.contact.findFirst({
      where: {
        organizationId: input.organizationId,
        phones: { some: { phone } },
      },
    })
    if (!exact) return { matched: false as const }
    return processInbound(exact.id, input)
  }
  return processInbound(contact.id, input)
}

async function processInbound(
  contactId: string,
  input: {
    organizationId: string
    fromPhone: string
    body: string
    providerMessageId?: string
  },
) {
  const thread = await getOrCreateThread({
    organizationId: input.organizationId,
    contactId,
    channel: "SMS",
  })

  const msg = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      threadId: thread.id,
      direction: "INBOUND",
      status: "RECEIVED",
      body: input.body,
      providerMessageId: input.providerMessageId ?? null,
      providerName: "twilio",
    },
  })

  await prisma.communicationThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date() },
  })

  if (isSmsStopBody(input.body)) {
    await prisma.contact.update({
      where: { id: contactId },
      data: { consentSms: false },
    })
    await writeAuditLog({
      organizationId: input.organizationId,
      entityType: "Contact",
      entityId: contactId,
      action: "OPT_OUT_SMS",
      after: { consentSms: false, via: "SMS STOP" },
      source: "INTEGRATION",
    })
    await prisma.activity.create({
      data: {
        organizationId: input.organizationId,
        contactId,
        type: "SYSTEM",
        subject: "SMS opt-out",
        body: "Contact replied STOP — consentSms set to false",
      },
    })
  } else {
    await prisma.activity.create({
      data: {
        organizationId: input.organizationId,
        contactId,
        type: "SMS",
        subject: "SMS received",
        body: input.body,
        metadata: { messageId: msg.id, direction: "INBOUND" },
      },
    })
  }

  return { matched: true as const, contactId, messageId: msg.id }
}

export async function updateContactConsent(
  organizationId: string,
  actorUserId: string,
  contactId: string,
  input: {
    doNotContact?: boolean
    consentEmail?: boolean
    consentSms?: boolean
    consentCall?: boolean
  },
) {
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
  })
  if (!existing) return null

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: {
      doNotContact: input.doNotContact,
      consentEmail: input.consentEmail,
      consentSms: input.consentSms,
      consentCall: input.consentCall,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Contact",
    entityId: contactId,
    action: "CONSENT_UPDATE",
    before: {
      doNotContact: existing.doNotContact,
      consentEmail: existing.consentEmail,
      consentSms: existing.consentSms,
      consentCall: existing.consentCall,
    },
    after: {
      doNotContact: updated.doNotContact,
      consentEmail: updated.consentEmail,
      consentSms: updated.consentSms,
      consentCall: updated.consentCall,
    },
  })

  return updated
}
