import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type { ContactPropertyRole, PropertyStatus, Prisma } from "@/generated/prisma/client"
import { z } from "zod"

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

export type CreatePropertyInput = z.infer<typeof createPropertySchema>

export async function listProperties(
  organizationId: string,
  filters?: { q?: string; status?: PropertyStatus },
) {
  const where: Prisma.PropertyWhereInput = { organizationId }
  if (filters?.status) where.status = filters.status
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
