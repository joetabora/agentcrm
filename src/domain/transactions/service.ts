import { z } from "zod"
import { addDays } from "date-fns"
import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type {
  ChecklistStatus,
  DeadlineKind,
  OfferStatus,
  PartyRole,
  Prisma,
  TransactionSide,
  TransactionStatus,
} from "@/generated/prisma/client"

const DEFAULT_CHECKLIST = [
  "Inspection contingency",
  "Financing contingency",
  "Earnest money deposited",
  "Closing documents prepared",
] as const

export const createTransactionFromOpportunitySchema = z.object({
  opportunityId: z.string().min(1),
  title: z.string().min(1).max(300).optional(),
  side: z.enum(["BUYER", "SELLER", "DUAL"]).optional(),
})

export const updateTransactionSchema = z.object({
  status: z
    .enum(["OPEN", "UNDER_CONTRACT", "CLOSED", "FELL_THROUGH", "CANCELLED"])
    .optional(),
  title: z.string().min(1).max(300).optional(),
  purchasePrice: z.coerce.number().nonnegative().optional().nullable(),
  closingDate: z.coerce.date().optional().nullable(),
  side: z.enum(["BUYER", "SELLER", "DUAL"]).optional(),
  gciAmount: z.coerce.number().nonnegative().optional().nullable(),
  agentSplitPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  brokerageSplitPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  propertyId: z.string().optional().nullable(),
})

export const addPartySchema = z.object({
  role: z.enum([
    "BUYER",
    "SELLER",
    "BUYER_AGENT",
    "SELLER_AGENT",
    "LENDER",
    "ATTORNEY",
    "TITLE",
    "OTHER",
  ]),
  contactId: z.string().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  isPrimary: z.boolean().optional(),
})

export const createOfferSchema = z.object({
  amount: z.coerce.number().positive(),
  status: z
    .enum(["DRAFT", "SUBMITTED", "COUNTERED", "ACCEPTED", "REJECTED", "WITHDRAWN"])
    .default("DRAFT"),
  submittedAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export const updateOfferStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SUBMITTED",
    "COUNTERED",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
  ]),
})

export const addDeadlineSchema = z.object({
  kind: z.enum([
    "INSPECTION",
    "FINANCING",
    "APPRAISAL",
    "EARNEST_MONEY",
    "CLOSING",
    "OTHER",
  ]),
  label: z.string().min(1).max(200),
  dueAt: z.coerce.date(),
})

export const addChecklistItemSchema = z.object({
  title: z.string().min(1).max(300),
  dueAt: z.coerce.date().optional().nullable(),
})

const txInclude = {
  opportunity: {
    include: { contact: true, pipelineStage: true },
  },
  property: true,
  parties: { include: { contact: true }, orderBy: { createdAt: "asc" as const } },
  offers: { orderBy: { createdAt: "desc" as const } },
  deadlines: { orderBy: { dueAt: "asc" as const } },
  checklist: { orderBy: { sortOrder: "asc" as const } },
  documents: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.TransactionInclude

export async function listTransactions(
  organizationId: string,
  filters?: { status?: TransactionStatus },
) {
  return prisma.transaction.findMany({
    where: {
      organizationId,
      ...(filters?.status ? { status: filters.status } : {}),
    },
    include: {
      opportunity: { include: { contact: true } },
      property: true,
      _count: { select: { offers: true, checklist: true, documents: true } },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getTransaction(organizationId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
    include: txInclude,
  })
}

export async function getTransactionByOpportunity(
  organizationId: string,
  opportunityId: string,
) {
  return prisma.transaction.findFirst({
    where: { organizationId, opportunityId },
    select: { id: true, status: true, title: true },
  })
}

export async function createTransactionFromOpportunity(
  organizationId: string,
  actorUserId: string,
  input: z.input<typeof createTransactionFromOpportunitySchema>,
) {
  const data = createTransactionFromOpportunitySchema.parse(input)

  const existing = await prisma.transaction.findFirst({
    where: { opportunityId: data.opportunityId, organizationId },
    include: txInclude,
  })
  if (existing) return existing

  const opportunity = await prisma.opportunity.findFirst({
    where: { id: data.opportunityId, organizationId },
    include: {
      contact: { include: { emails: true } },
      property: true,
    },
  })
  if (!opportunity) throw new Error("Opportunity not found")

  const side: TransactionSide =
    data.side ?? (opportunity.type === "SELLER" ? "SELLER" : "BUYER")
  const title =
    data.title?.trim() ||
    `Transaction — ${opportunity.title}`

  const primaryEmail =
    opportunity.contact.emails.find((e) => e.isPrimary)?.email ??
    opportunity.contact.emails[0]?.email ??
    null

  const transaction = await prisma.transaction.create({
    data: {
      organizationId,
      opportunityId: opportunity.id,
      propertyId: opportunity.propertyId,
      status: "OPEN",
      title,
      side,
      purchasePrice: opportunity.estimatedValue,
      parties: {
        create: {
          contactId: opportunity.contactId,
          role: side === "SELLER" ? "SELLER" : "BUYER",
          name: `${opportunity.contact.firstName} ${opportunity.contact.lastName}`,
          email: primaryEmail,
          isPrimary: true,
        },
      },
      checklist: {
        create: DEFAULT_CHECKLIST.map((item, i) => ({
          title: item,
          sortOrder: i,
          status: "TODO" as ChecklistStatus,
        })),
      },
      deadlines: {
        create: [
          {
            kind: "INSPECTION" as DeadlineKind,
            label: "Inspection deadline",
            dueAt: addDays(new Date(), 10),
          },
          {
            kind: "CLOSING" as DeadlineKind,
            label: "Target closing",
            dueAt: addDays(new Date(), 45),
          },
        ],
      },
    },
    include: txInclude,
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Transaction",
    entityId: transaction.id,
    action: "CREATE",
    after: {
      opportunityId: opportunity.id,
      title: transaction.title,
      status: transaction.status,
    },
  })

  return transaction
}

export async function updateTransaction(
  organizationId: string,
  actorUserId: string,
  transactionId: string,
  input: z.input<typeof updateTransactionSchema>,
) {
  const data = updateTransactionSchema.parse(input)
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
  })
  if (!existing) return null

  if (data.propertyId) {
    const prop = await prisma.property.findFirst({
      where: { id: data.propertyId, organizationId },
    })
    if (!prop) throw new Error("Property not found in organization")
  }

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: data.status as TransactionStatus | undefined,
      title: data.title,
      purchasePrice: data.purchasePrice ?? undefined,
      closingDate: data.closingDate === undefined ? undefined : data.closingDate,
      side: data.side as TransactionSide | undefined,
      gciAmount: data.gciAmount === undefined ? undefined : data.gciAmount,
      agentSplitPercent:
        data.agentSplitPercent === undefined ? undefined : data.agentSplitPercent,
      brokerageSplitPercent:
        data.brokerageSplitPercent === undefined
          ? undefined
          : data.brokerageSplitPercent,
      notes: data.notes === undefined ? undefined : data.notes,
      propertyId: data.propertyId === undefined ? undefined : data.propertyId,
    },
    include: txInclude,
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Transaction",
    entityId: transactionId,
    action: "UPDATE",
    before: {
      status: existing.status,
      purchasePrice: existing.purchasePrice,
    },
    after: {
      status: updated.status,
      purchasePrice: updated.purchasePrice,
    },
  })

  return updated
}

export async function addParty(
  organizationId: string,
  actorUserId: string,
  transactionId: string,
  input: z.input<typeof addPartySchema>,
) {
  const data = addPartySchema.parse(input)
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
  })
  if (!tx) throw new Error("Transaction not found")

  let name = data.name?.trim()
  let email = data.email ?? null
  const contactId = data.contactId ?? null

  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: { emails: true },
    })
    if (!contact) throw new Error("Contact not found in organization")
    name = name || `${contact.firstName} ${contact.lastName}`
    email =
      email ||
      contact.emails.find((e) => e.isPrimary)?.email ||
      contact.emails[0]?.email ||
      null
  }
  if (!name) throw new Error("Party name required")

  const party = await prisma.transactionParty.create({
    data: {
      transactionId,
      contactId,
      role: data.role as PartyRole,
      name,
      email,
      isPrimary: data.isPrimary ?? false,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "TransactionParty",
    entityId: party.id,
    action: "CREATE",
    after: { transactionId, role: party.role, name: party.name },
  })

  return party
}

export async function createOffer(
  organizationId: string,
  actorUserId: string,
  transactionId: string,
  input: z.input<typeof createOfferSchema>,
) {
  const data = createOfferSchema.parse(input)
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
  })
  if (!tx) throw new Error("Transaction not found")

  const offer = await prisma.offer.create({
    data: {
      transactionId,
      amount: data.amount,
      status: data.status as OfferStatus,
      submittedAt:
        data.submittedAt ??
        (data.status === "SUBMITTED" || data.status === "ACCEPTED"
          ? new Date()
          : null),
      expiresAt: data.expiresAt ?? null,
      notes: data.notes ?? null,
      createdByUserId: actorUserId,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Offer",
    entityId: offer.id,
    action: "CREATE",
    after: { transactionId, amount: offer.amount, status: offer.status },
  })

  return offer
}

export async function updateOfferStatus(
  organizationId: string,
  actorUserId: string,
  offerId: string,
  input: z.input<typeof updateOfferStatusSchema>,
) {
  const data = updateOfferStatusSchema.parse(input)
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, transaction: { organizationId } },
  })
  if (!offer) return null

  const updated = await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: data.status as OfferStatus,
      submittedAt:
        data.status === "SUBMITTED" && !offer.submittedAt
          ? new Date()
          : offer.submittedAt,
    },
  })

  if (data.status === "ACCEPTED") {
    await prisma.transaction.update({
      where: { id: offer.transactionId },
      data: {
        status: "UNDER_CONTRACT",
        purchasePrice: offer.amount,
      },
    })
  }

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Offer",
    entityId: offerId,
    action: "STATUS_CHANGE",
    before: { status: offer.status },
    after: { status: updated.status },
  })

  return updated
}

export async function addDeadline(
  organizationId: string,
  actorUserId: string,
  transactionId: string,
  input: z.input<typeof addDeadlineSchema>,
) {
  const data = addDeadlineSchema.parse(input)
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
  })
  if (!tx) throw new Error("Transaction not found")

  const deadline = await prisma.transactionDeadline.create({
    data: {
      transactionId,
      kind: data.kind as DeadlineKind,
      label: data.label,
      dueAt: data.dueAt,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "TransactionDeadline",
    entityId: deadline.id,
    action: "CREATE",
    after: { transactionId, kind: deadline.kind, dueAt: deadline.dueAt },
  })

  return deadline
}

export async function completeDeadline(
  organizationId: string,
  actorUserId: string,
  deadlineId: string,
) {
  const deadline = await prisma.transactionDeadline.findFirst({
    where: { id: deadlineId, transaction: { organizationId } },
  })
  if (!deadline) return null

  const updated = await prisma.transactionDeadline.update({
    where: { id: deadlineId },
    data: { completedAt: new Date() },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "TransactionDeadline",
    entityId: deadlineId,
    action: "COMPLETE",
  })

  return updated
}

export async function addChecklistItem(
  organizationId: string,
  actorUserId: string,
  transactionId: string,
  input: z.input<typeof addChecklistItemSchema>,
) {
  const data = addChecklistItemSchema.parse(input)
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
  })
  if (!tx) throw new Error("Transaction not found")

  const max = await prisma.transactionChecklistItem.aggregate({
    where: { transactionId },
    _max: { sortOrder: true },
  })

  const item = await prisma.transactionChecklistItem.create({
    data: {
      transactionId,
      title: data.title,
      dueAt: data.dueAt ?? null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "TransactionChecklistItem",
    entityId: item.id,
    action: "CREATE",
    after: { title: item.title },
  })

  return item
}

export async function setChecklistStatus(
  organizationId: string,
  actorUserId: string,
  itemId: string,
  status: ChecklistStatus,
) {
  const item = await prisma.transactionChecklistItem.findFirst({
    where: { id: itemId, transaction: { organizationId } },
  })
  if (!item) return null

  const updated = await prisma.transactionChecklistItem.update({
    where: { id: itemId },
    data: { status },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "TransactionChecklistItem",
    entityId: itemId,
    action: "STATUS_CHANGE",
    before: { status: item.status },
    after: { status: updated.status },
  })

  return updated
}
