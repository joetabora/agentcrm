import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type { ContactType, LeadTemperature, LifecycleStage, Prisma } from "@/generated/prisma/client"
import { z } from "zod"

export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  preferredName: z.string().max(100).optional().nullable(),
  contactType: z.enum([
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
  ] as const),
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
    ] as const)
    .optional(),
  temperature: z.enum(["COLD", "WARM", "HOT"] as const).optional().nullable(),
  source: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  notesSummary: z.string().max(5000).optional().nullable(),
  doNotContact: z.boolean().optional(),
  consentEmail: z.boolean().optional(),
  consentSms: z.boolean().optional(),
  consentCall: z.boolean().optional(),
})

export type CreateContactInput = z.input<typeof createContactSchema>

export async function listContacts(
  organizationId: string,
  filters?: {
    q?: string
    contactType?: ContactType
    lifecycleStage?: LifecycleStage
  },
) {
  const where: Prisma.ContactWhereInput = {
    organizationId,
  }

  if (filters?.contactType) where.contactType = filters.contactType
  if (filters?.lifecycleStage) where.lifecycleStage = filters.lifecycleStage
  if (filters?.q) {
    const q = filters.q.trim()
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { emails: { some: { email: { contains: q, mode: "insensitive" } } } },
      { phones: { some: { phone: { contains: q } } } },
    ]
  }

  return prisma.contact.findMany({
    where,
    include: {
      emails: true,
      phones: true,
      tags: { include: { tag: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

export async function getContact(organizationId: string, contactId: string) {
  return prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    include: {
      emails: true,
      phones: true,
      addresses: true,
      tags: { include: { tag: true } },
      properties: { include: { property: true } },
      opportunities: {
        include: { pipelineStage: true, pipeline: true },
        orderBy: { updatedAt: "desc" },
      },
      tasks: {
        where: { status: "OPEN" },
        orderBy: { dueAt: "asc" },
        take: 20,
      },
      appointments: {
        where: { status: "SCHEDULED" },
        orderBy: { startsAt: "asc" },
        take: 10,
      },
      facts: { orderBy: { createdAt: "desc" }, take: 20 },
      relationshipsFrom: {
        include: { toContact: true },
      },
      relationshipsTo: {
        include: { fromContact: true },
      },
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: { actor: true },
      },
    },
  })
}

export async function createContact(
  organizationId: string,
  actorUserId: string,
  input: CreateContactInput,
) {
  const data = createContactSchema.parse(input)

  const contact = await prisma.contact.create({
    data: {
      organizationId,
      firstName: data.firstName,
      lastName: data.lastName,
      preferredName: data.preferredName ?? null,
      contactType: data.contactType as ContactType,
      lifecycleStage: (data.lifecycleStage as LifecycleStage) ?? "NEW",
      temperature: (data.temperature as LeadTemperature | null | undefined) ?? null,
      source: data.source ?? null,
      notesSummary: data.notesSummary ?? null,
      doNotContact: data.doNotContact ?? false,
      consentEmail: data.consentEmail ?? false,
      consentSms: data.consentSms ?? false,
      consentCall: data.consentCall ?? false,
      firstContactAt: new Date(),
      emails: data.email
        ? { create: [{ email: data.email.toLowerCase(), isPrimary: true, label: "primary" }] }
        : undefined,
      phones: data.phone
        ? { create: [{ phone: data.phone, isPrimary: true, label: "mobile" }] }
        : undefined,
    },
    include: { emails: true, phones: true },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: contact.id,
      actorUserId,
      type: "SYSTEM",
      subject: "Contact created",
      body: `${contact.firstName} ${contact.lastName} added to CRM`,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Contact",
    entityId: contact.id,
    action: "CREATE",
    after: { firstName: contact.firstName, lastName: contact.lastName },
  })

  return contact
}

export async function updateContact(
  organizationId: string,
  actorUserId: string,
  contactId: string,
  input: Partial<CreateContactInput>,
) {
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
  })
  if (!existing) return null

  const contact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
      preferredName: input.preferredName === undefined ? undefined : input.preferredName,
      contactType: input.contactType as ContactType | undefined,
      lifecycleStage: input.lifecycleStage as LifecycleStage | undefined,
      temperature:
        input.temperature === undefined
          ? undefined
          : (input.temperature as LeadTemperature | null),
      source: input.source === undefined ? undefined : input.source,
      notesSummary: input.notesSummary === undefined ? undefined : input.notesSummary,
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
    entityId: contact.id,
    action: "UPDATE",
    before: {
      firstName: existing.firstName,
      lastName: existing.lastName,
      lifecycleStage: existing.lifecycleStage,
      doNotContact: existing.doNotContact,
      consentEmail: existing.consentEmail,
      consentSms: existing.consentSms,
      consentCall: existing.consentCall,
    },
    after: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      lifecycleStage: contact.lifecycleStage,
      doNotContact: contact.doNotContact,
      consentEmail: contact.consentEmail,
      consentSms: contact.consentSms,
      consentCall: contact.consentCall,
    },
  })

  return contact
}
