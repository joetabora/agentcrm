import { prisma } from "@/lib/db"
import type { ActivityType } from "@/generated/prisma/client"
import { z } from "zod"

export const createNoteSchema = z.object({
  contactId: z.string().min(1),
  body: z.string().min(1).max(10000),
  subject: z.string().max(200).optional(),
  opportunityId: z.string().optional().nullable(),
})

export async function addNote(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof createNoteSchema>,
) {
  const data = createNoteSchema.parse(input)

  const contact = await prisma.contact.findFirst({
    where: { id: data.contactId, organizationId },
  })
  if (!contact) throw new Error("Contact not found")

  const activity = await prisma.activity.create({
    data: {
      organizationId,
      contactId: data.contactId,
      opportunityId: data.opportunityId ?? null,
      actorUserId,
      type: "NOTE" satisfies ActivityType,
      subject: data.subject ?? "Note",
      body: data.body,
    },
  })

  await prisma.contact.update({
    where: { id: data.contactId },
    data: { lastContactedAt: new Date() },
  })

  return activity
}

export async function listActivitiesForContact(organizationId: string, contactId: string) {
  return prisma.activity.findMany({
    where: { organizationId, contactId },
    include: { actor: true },
    orderBy: { occurredAt: "desc" },
    take: 100,
  })
}
