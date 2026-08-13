import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type {
  ContactPropertyRole,
  PropertyStatus,
} from "@/generated/prisma/client"
import { Prisma } from "@/generated/prisma/client"
import { z } from "zod"
import {
  parseBuyerPreferences,
  updateBuyerPreferencesSchema,
  type UpdateBuyerPreferencesInput,
} from "@/domain/properties/preferences"
import {
  MATCHABLE_STATUSES,
  prefsFromContact,
  scorePropertyAgainstPrefs,
  toMatchableProperty,
  daysOnMarket,
} from "@/domain/properties/match"

export const createPropertySchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  propertyType: z.string().max(100).optional().nullable(),
  beds: z.number().optional().nullable(),
  baths: z.number().optional().nullable(),
  sqft: z.number().int().optional().nullable(),
  listPrice: z.number().nonnegative().optional().nullable(),
  listedAt: z.coerce.date().optional().nullable(),
  status: z
    .enum([
      "UNKNOWN",
      "PRE_LISTING",
      "ACTIVE",
      "PENDING",
      "SOLD",
      "EXPIRED",
      "WITHDRAWN",
      "CANCELLED",
      "OFF_MARKET",
    ] as const)
    .optional(),
  description: z.string().max(10000).optional().nullable(),
  contactId: z.string().optional().nullable(),
  contactRole: z
    .enum(["OWNER", "BUYER_INTEREST", "LISTING_CLIENT", "TENANT", "PREVIOUS_OWNER", "OTHER"] as const)
    .optional(),
})

export type CreatePropertyInput = z.input<typeof createPropertySchema>

export async function listProperties(
  organizationId: string,
  filters?: {
    q?: string
    status?: PropertyStatus
    city?: string
    minPrice?: number
    maxPrice?: number
  },
) {
  const where: Prisma.PropertyWhereInput = { organizationId }
  if (filters?.status) where.status = filters.status
  if (filters?.city?.trim()) {
    where.city = { equals: filters.city.trim(), mode: "insensitive" }
  }
  if (filters?.minPrice != null || filters?.maxPrice != null) {
    where.listPrice = {}
    if (filters.minPrice != null) where.listPrice.gte = filters.minPrice
    if (filters.maxPrice != null) where.listPrice.lte = filters.maxPrice
  }
  if (filters?.q) {
    const q = filters.q.trim()
    where.OR = [
      { line1: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { postalCode: { contains: q, mode: "insensitive" } },
      { mlsNumber: { contains: q, mode: "insensitive" } },
    ]
  }

  return prisma.property.findMany({
    where,
    include: {
      contacts: { include: { contact: true } },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getProperty(organizationId: string, propertyId: string) {
  return prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    include: {
      contacts: { include: { contact: true } },
      opportunities: { include: { contact: true, pipelineStage: true } },
      tasks: { where: { status: "OPEN" }, take: 20 },
      priceEvents: { orderBy: { notedAt: "desc" }, take: 50 },
    },
  })
}

export async function createProperty(
  organizationId: string,
  actorUserId: string,
  input: CreatePropertyInput,
) {
  const data = createPropertySchema.parse(input)

  const property = await prisma.property.create({
    data: {
      organizationId,
      line1: data.line1,
      line2: data.line2 ?? null,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      propertyType: data.propertyType ?? null,
      beds: data.beds ?? null,
      baths: data.baths ?? null,
      sqft: data.sqft ?? null,
      listPrice: data.listPrice ?? null,
      listedAt: data.listedAt ?? null,
      status: (data.status as PropertyStatus) ?? "UNKNOWN",
      description: data.description ?? null,
      provenance: "USER_ENTERED",
      contacts:
        data.contactId
          ? {
              create: [
                {
                  contactId: data.contactId,
                  role: (data.contactRole as ContactPropertyRole) ?? "OWNER",
                },
              ],
            }
          : undefined,
    },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      propertyId: property.id,
      contactId: data.contactId ?? null,
      actorUserId,
      type: "SYSTEM",
      subject: "Property created",
      body: `${property.line1}, ${property.city}`,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Property",
    entityId: property.id,
    action: "CREATE",
    after: { line1: property.line1, city: property.city },
  })

  return property
}

export async function updateBuyerPreferences(
  organizationId: string,
  actorUserId: string,
  contactId: string,
  input: UpdateBuyerPreferencesInput,
) {
  const data = updateBuyerPreferencesSchema.parse(input)
  const prefs = parseBuyerPreferences(data.preferences)

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
  })
  if (!existing) return null

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: {
      budgetMin: data.budgetMin === undefined ? undefined : data.budgetMin,
      budgetMax: data.budgetMax === undefined ? undefined : data.budgetMax,
      preferences: prefs as Prisma.InputJsonValue,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Contact",
    entityId: contactId,
    action: "PREFERENCES_UPDATE",
    before: {
      budgetMin: existing.budgetMin,
      budgetMax: existing.budgetMax,
      preferences: existing.preferences as Prisma.InputJsonValue,
    },
    after: {
      budgetMin: updated.budgetMin,
      budgetMax: updated.budgetMax,
      preferences: prefs as Prisma.InputJsonValue,
    },
  })

  return updated
}

export async function matchPropertiesForContact(
  organizationId: string,
  contactId: string,
  limit = 25,
) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
  })
  if (!contact) return []

  const { prefs, budget } = prefsFromContact(contact)
  const hasCriteria =
    budget.budgetMin != null ||
    budget.budgetMax != null ||
    Object.keys(prefs).length > 0
  if (!hasCriteria) return []

  const properties = await prisma.property.findMany({
    where: {
      organizationId,
      status: { in: [...MATCHABLE_STATUSES] },
    },
  })

  const now = new Date()
  return properties
    .map((p) => {
      const matchable = toMatchableProperty(p)
      const result = scorePropertyAgainstPrefs(matchable, prefs, budget, now)
      return {
        property: p,
        ...result,
        dom: daysOnMarket(p.listedAt, now),
      }
    })
    .filter((r) => !r.hardFail && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export async function matchContactsForProperty(
  organizationId: string,
  propertyId: string,
  limit = 25,
) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
  })
  if (!property) return []

  const matchable = toMatchableProperty(property)
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      OR: [
        { budgetMin: { not: null } },
        { budgetMax: { not: null } },
        { NOT: { preferences: { equals: Prisma.DbNull } } },
      ],
      doNotContact: false,
    },
    take: 200,
  })

  const now = new Date()
  const scored = []
  for (const c of contacts) {
    let prefs
    let budget
    try {
      ;({ prefs, budget } = prefsFromContact(c))
    } catch {
      continue
    }
    const hasCriteria =
      budget.budgetMin != null ||
      budget.budgetMax != null ||
      Object.keys(prefs).length > 0
    if (!hasCriteria) continue
    const result = scorePropertyAgainstPrefs(matchable, prefs, budget, now)
    if (result.hardFail || result.score <= 0) continue
    scored.push({
      contact: c,
      ...result,
    })
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}

export async function saveBuyerInterest(
  organizationId: string,
  actorUserId: string,
  contactId: string,
  propertyId: string,
) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
  })
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
  })
  if (!contact || !property) return null

  const link = await prisma.contactProperty.upsert({
    where: {
      contactId_propertyId_role: {
        contactId,
        propertyId,
        role: "BUYER_INTEREST",
      },
    },
    create: {
      contactId,
      propertyId,
      role: "BUYER_INTEREST",
    },
    update: {},
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "ContactProperty",
    entityId: link.id,
    action: "SAVE_INTEREST",
    after: { contactId, propertyId, role: "BUYER_INTEREST" },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId,
      propertyId,
      actorUserId,
      type: "PROPERTY_VIEW",
      subject: "Buyer interest saved",
      body: `${property.line1}, ${property.city}`,
    },
  })

  return link
}

export async function updatePropertyListedAt(
  organizationId: string,
  actorUserId: string,
  propertyId: string,
  listedAt: Date | null,
) {
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
  })
  if (!existing) return null

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { listedAt },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Property",
    entityId: propertyId,
    action: "LISTED_AT_UPDATE",
    before: { listedAt: existing.listedAt },
    after: { listedAt },
  })

  return updated
}

export async function addPropertyPriceEvent(
  organizationId: string,
  actorUserId: string,
  propertyId: string,
  input: { price: number; note?: string | null; notedAt?: Date },
) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
  })
  if (!property) return null

  const event = await prisma.propertyPriceEvent.create({
    data: {
      organizationId,
      propertyId,
      price: input.price,
      note: input.note ?? null,
      notedAt: input.notedAt ?? new Date(),
      provenance: "USER_ENTERED",
    },
  })

  await prisma.property.update({
    where: { id: propertyId },
    data: { listPrice: input.price },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "PropertyPriceEvent",
    entityId: event.id,
    action: "CREATE",
    after: { price: input.price, propertyId },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      propertyId,
      actorUserId,
      type: "SYSTEM",
      subject: "Price change recorded",
      body: `New list price ${input.price}${input.note ? ` — ${input.note}` : ""}`,
    },
  })

  return event
}
