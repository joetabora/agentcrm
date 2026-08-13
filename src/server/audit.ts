import { prisma } from "@/lib/db"
import type { AuditSource, Prisma } from "@/generated/prisma/client"

export async function writeAuditLog(input: {
  organizationId: string
  actorUserId?: string | null
  entityType: string
  entityId: string
  action: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  source?: AuditSource
}) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before,
      after: input.after,
      source: input.source ?? "USER",
    },
  })
}
