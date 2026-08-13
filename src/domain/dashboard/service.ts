import { prisma } from "@/lib/db"
import { endOfDay, startOfDay, subDays } from "date-fns"
import { getRankedAgenda } from "@/domain/agenda/service"
import { unsnoozeDueTasks } from "@/domain/tasks/service"

export async function getDashboardData(organizationId: string, currentUserId?: string) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const fourteenDaysAgo = subDays(now, 14)

  await unsnoozeDueTasks(organizationId)

  const [
    agenda,
    overdueTasks,
    newLeads,
    hotLeads,
    uncontactedLeads,
    buyerCount,
    sellerCount,
    openOpportunityCount,
  ] = await Promise.all([
    getRankedAgenda(organizationId, {
      assigneeUserId: currentUserId,
      limit: 20,
    }),
    prisma.task.findMany({
      where: {
        organizationId,
        status: "OPEN",
        dueAt: { lt: todayStart },
        ...(currentUserId ? { assigneeUserId: currentUserId } : {}),
      },
      include: { contact: true },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        createdAt: { gte: todayStart },
      },
      include: { contact: true, pipelineStage: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        temperature: "HOT",
        pipelineStage: { isTerminal: false },
      },
      include: { contact: true, pipelineStage: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        pipelineStage: { key: "NEW" },
        OR: [{ lastContactAt: null }, { firstContactAt: null }],
      },
      include: { contact: true, pipelineStage: true },
      take: 20,
    }),
    prisma.opportunity.count({
      where: {
        organizationId,
        type: "BUYER",
        pipelineStage: { isTerminal: false },
      },
    }),
    prisma.opportunity.count({
      where: {
        organizationId,
        type: "SELLER",
        pipelineStage: { isTerminal: false },
      },
    }),
    prisma.opportunity.count({
      where: {
        organizationId,
        pipelineStage: { isTerminal: false },
      },
    }),
  ])

  const coldContacts = await prisma.contact.findMany({
    where: {
      organizationId,
      OR: [
        { lastContactedAt: { lt: fourteenDaysAgo } },
        { lastContactedAt: null, createdAt: { lt: fourteenDaysAgo } },
      ],
      doNotContact: false,
    },
    take: 10,
    orderBy: { lastContactedAt: "asc" },
  })

  const overdueFollowUps = agenda.ranked.filter((i) => i.kind === "follow_up")

  return {
    rankedAgenda: agenda.ranked,
    appointmentsToday: agenda.appointmentsToday,
    overdueTasks,
    overdueFollowUps,
    newLeads,
    hotLeads,
    uncontactedLeads,
    coldContacts,
    todayWindow: { start: todayStart, end: todayEnd },
    pipeline: {
      buyers: buyerCount,
      sellers: sellerCount,
      open: openOpportunityCount,
    },
  }
}
