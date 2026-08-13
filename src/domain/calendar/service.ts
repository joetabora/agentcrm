import { endOfDay, startOfDay } from "date-fns"
import { prisma } from "@/lib/db"
import { listAppointments, listTasks } from "@/domain/tasks/service"

export type CalendarEventKind = "appointment" | "task" | "deadline"

export type CalendarEvent = {
  id: string
  kind: CalendarEventKind
  title: string
  startsAt: Date
  endsAt: Date | null
  href: string
  meta?: string
}

export async function listCalendarEvents(
  organizationId: string,
  range: { from: Date; to: Date },
): Promise<CalendarEvent[]> {
  const from = startOfDay(range.from)
  const to = endOfDay(range.to)

  const [appointments, tasks, deadlines] = await Promise.all([
    listAppointments(organizationId, { from, to, status: "SCHEDULED" }),
    listTasks(organizationId, {
      filter: "open",
      dueAfter: from,
      dueBefore: to,
    }),
    prisma.transactionDeadline.findMany({
      where: {
        dueAt: { gte: from, lte: to },
        completedAt: null,
        transaction: { organizationId },
      },
      include: {
        transaction: { select: { id: true, title: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 100,
    }),
  ])

  const events: CalendarEvent[] = [
    ...appointments.map((a) => ({
      id: `appt-${a.id}`,
      kind: "appointment" as const,
      title: a.title,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      href: a.contactId ? `/app/contacts/${a.contactId}` : "/app/tasks",
      meta: a.contact
        ? `${a.contact.firstName} ${a.contact.lastName}`
        : a.location ?? undefined,
    })),
    ...tasks
      .filter((t) => t.dueAt)
      .map((t) => ({
        id: `task-${t.id}`,
        kind: "task" as const,
        title: t.title,
        startsAt: t.dueAt!,
        endsAt: null,
        href: "/app/tasks",
        meta: t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : t.priority,
      })),
    ...deadlines.map((d) => ({
      id: `deadline-${d.id}`,
      kind: "deadline" as const,
      title: d.label,
      startsAt: d.dueAt,
      endsAt: null,
      href: `/app/transactions/${d.transaction.id}`,
      meta: d.transaction.title,
    })),
  ]

  return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
