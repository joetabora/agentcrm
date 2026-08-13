import { prisma } from "@/lib/db"

export async function listOrgMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: {
      organizationId,
      role: { in: ["OWNER", "ADMIN", "AGENT", "ASSISTANT"] },
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  })
}
