import { prisma } from "@/lib/db"
import type { MembershipRole, OpportunityType } from "@/generated/prisma/client"

const DEFAULT_STAGES: { key: string; name: string; position: number; isTerminal?: boolean }[] = [
  { key: "NEW", name: "New", position: 0 },
  { key: "CONTACTED", name: "Contacted", position: 1 },
  { key: "ENGAGED", name: "Engaged", position: 2 },
  { key: "QUALIFIED", name: "Qualified", position: 3 },
  { key: "APPOINTMENT", name: "Appointment", position: 4 },
  { key: "ACTIVE_CLIENT", name: "Active Client", position: 5 },
  { key: "UNDER_CONTRACT", name: "Under Contract", position: 6 },
  { key: "CLOSED", name: "Closed", position: 7 },
  { key: "PAST_CLIENT", name: "Past Client", position: 8 },
  { key: "NURTURE", name: "Nurture", position: 9 },
  { key: "LOST", name: "Lost", position: 10, isTerminal: true },
]

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)
  return `${base || "org"}-${Math.random().toString(36).slice(2, 8)}`
}

async function createDefaultPipelines(organizationId: string) {
  const types: OpportunityType[] = ["BUYER", "SELLER"]
  for (const type of types) {
    await prisma.pipeline.create({
      data: {
        organizationId,
        name: type === "BUYER" ? "Buyer Pipeline" : "Seller Pipeline",
        type,
        isDefault: true,
        stages: {
          create: DEFAULT_STAGES.map((s) => ({
            key: s.key,
            name: s.name,
            position: s.position,
            isTerminal: s.isTerminal ?? false,
          })),
        },
      },
    })
  }
}

export async function createOrganizationForUser(input: {
  userId: string
  name: string
  role?: MembershipRole
}) {
  const organization = await prisma.organization.create({
    data: {
      name: input.name,
      slug: slugify(input.name),
      memberships: {
        create: {
          userId: input.userId,
          role: input.role ?? "OWNER",
        },
      },
    },
  })

  await createDefaultPipelines(organization.id)
  return organization
}

export async function getMembershipForUser(userId: string) {
  return prisma.membership.findFirst({
    where: { userId },
    include: { organization: true, user: true },
    orderBy: { createdAt: "asc" },
  })
}
