import { prisma } from "@/lib/db"

export type SearchResult = {
  type: "contact" | "property" | "opportunity" | "task"
  id: string
  title: string
  subtitle?: string
  href: string
}

export async function globalSearch(
  organizationId: string,
  query: string,
  limit = 8,
): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []

  const [contacts, properties, opportunities, tasks] = await Promise.all([
    prisma.contact.findMany({
      where: {
        organizationId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { emails: { some: { email: { contains: q, mode: "insensitive" } } } },
          { phones: { some: { phone: { contains: q } } } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.property.findMany({
      where: {
        organizationId,
        OR: [
          { line1: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { postalCode: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { source: { contains: q, mode: "insensitive" } },
          { contact: { lastName: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { contact: true, pipelineStage: true },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        organizationId,
        title: { contains: q, mode: "insensitive" },
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
  ])

  const results: SearchResult[] = [
    ...contacts.map((c) => ({
      type: "contact" as const,
      id: c.id,
      title: `${c.firstName} ${c.lastName}`,
      subtitle: c.contactType,
      href: `/app/contacts/${c.id}`,
    })),
    ...properties.map((p) => ({
      type: "property" as const,
      id: p.id,
      title: p.line1,
      subtitle: `${p.city}, ${p.state}`,
      href: `/app/properties/${p.id}`,
    })),
    ...opportunities.map((o) => ({
      type: "opportunity" as const,
      id: o.id,
      title: o.title,
      subtitle: `${o.contact.firstName} ${o.contact.lastName} · ${o.pipelineStage.name}`,
      href: `/app/leads`,
    })),
    ...tasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      subtitle: t.status,
      href: `/app/tasks`,
    })),
  ]

  return results.slice(0, limit * 2)
}
