import { prisma } from "@/lib/db"
import type { Prisma, SavedViewEntity } from "@/generated/prisma/client"
import { z } from "zod"

export const createSavedViewSchema = z.object({
  name: z.string().min(1).max(120),
  entity: z.enum(["LEADS", "CONTACTS"]).default("LEADS"),
  filters: z.record(z.string(), z.unknown()),
  isShared: z.boolean().default(false),
})

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>

export async function listSavedViews(
  organizationId: string,
  userId: string,
  entity: SavedViewEntity = "LEADS",
) {
  return prisma.savedView.findMany({
    where: {
      organizationId,
      entity,
      OR: [{ ownerUserId: userId }, { isShared: true }],
    },
    orderBy: [{ isShared: "desc" }, { name: "asc" }],
  })
}

export async function createSavedView(
  organizationId: string,
  ownerUserId: string,
  input: CreateSavedViewInput,
) {
  const data = createSavedViewSchema.parse(input)
  return prisma.savedView.create({
    data: {
      organizationId,
      ownerUserId,
      name: data.name,
      entity: data.entity,
      filters: data.filters as Prisma.InputJsonValue,
      isShared: data.isShared,
    },
  })
}

export async function deleteSavedView(
  organizationId: string,
  userId: string,
  viewId: string,
) {
  const view = await prisma.savedView.findFirst({
    where: {
      id: viewId,
      organizationId,
      OR: [{ ownerUserId: userId }, { isShared: true }],
    },
  })
  if (!view) return null
  if (view.ownerUserId !== userId) {
    throw new Error("Only the owner can delete this saved view")
  }
  await prisma.savedView.delete({ where: { id: viewId } })
  return view
}

export async function getSavedView(
  organizationId: string,
  userId: string,
  viewId: string,
) {
  return prisma.savedView.findFirst({
    where: {
      id: viewId,
      organizationId,
      OR: [{ ownerUserId: userId }, { isShared: true }],
    },
  })
}
