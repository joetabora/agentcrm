import { prisma } from "@/lib/db"
import { endOfDay, startOfDay } from "date-fns"
import { unsnoozeDueTasks } from "@/domain/tasks/service"
import {
  mergeAgenda,
  rankTasks,
  scoreFollowUp,
  type RankedAgendaItem,
} from "@/domain/agenda/ranking"

export async function getRankedAgenda(
  organizationId: string,
  options?: { assigneeUserId?: string; limit?: number },
): Promise<{
  ranked: RankedAgendaItem[]
  appointmentsToday: Awaited<ReturnType<typeof loadAppointmentsToday>>
}> {
  await unsnoozeDueTasks(organizationId)
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const limit = options?.limit ?? 25

  const [openTasks, overdueFollowUps, appointmentsToday] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId,
        status: "OPEN",
        ...(options?.assigneeUserId ? { assigneeUserId: options.assigneeUserId } : {}),
      },
      include: {
        contact: true,
        opportunity: { include: { pipelineStage: true } },
      },
      take: 100,
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        nextActionAt: { lt: now },
        pipelineStage: { isTerminal: false },
      },
      include: { contact: true, pipelineStage: true },
      take: 30,
    }),
    loadAppointmentsToday(organizationId, todayStart, todayEnd),
  ])

  const rankedTasks = rankTasks(openTasks, now)
  const followUpItems: RankedAgendaItem[] = overdueFollowUps.map((o) => {
    const { score, reasons } = scoreFollowUp({
      id: o.id,
      title: o.nextAction?.trim() || `Follow up: ${o.title}`,
      nextActionAt: o.nextActionAt,
      nextAction: o.nextAction,
      temperature: o.temperature,
      contactId: o.contactId,
      firstContactAt: o.firstContactAt,
      lastContactAt: o.lastContactAt,
    })
    return {
      kind: "follow_up" as const,
      id: o.id,
      title: o.nextAction?.trim() || `Follow up: ${o.title}`,
      score,
      reasons,
      dueAt: o.nextActionAt,
      contactId: o.contactId,
      opportunityId: o.id,
    }
  })

  return {
    ranked: mergeAgenda(rankedTasks, followUpItems, limit),
    appointmentsToday,
  }
}

async function loadAppointmentsToday(organizationId: string, from: Date, to: Date) {
  return prisma.appointment.findMany({
    where: {
      organizationId,
      status: "SCHEDULED",
      startsAt: { gte: from, lte: to },
    },
    include: { contact: true, property: true },
    orderBy: { startsAt: "asc" },
    take: 20,
  })
}
