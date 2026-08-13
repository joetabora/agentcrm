import { prisma } from "@/lib/db"
import { endOfDay, startOfDay, subDays } from "date-fns"

export async function getDashboardData(organizationId: string) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const fourteenDaysAgo = subDays(now, 14)

  const [
    tasksDueToday,
    overdueTasks,
    appointmentsToday,
    newLeads,
    hotLeads,
    uncontactedLeads,
    overdueFollowUps,
    buyerCount,
    sellerCount,
    openOpportunityCount,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId,
        status: "OPEN",
        dueAt: { gte: todayStart, lte: todayEnd },
      },
      include: { contact: true },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: {
        organizationId,
        status: "OPEN",
        dueAt: { lt: todayStart },
      },
      include: { contact: true },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
    prisma.appointment.findMany({
      where: {
        organizationId,
        status: "SCHEDULED",
        startsAt: { gte: todayStart, lte: todayEnd },
      },
      include: { contact: true, property: true },
      orderBy: { startsAt: "asc" },
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
    prisma.opportunity.findMany({
      where: {
        organizationId,
        nextActionAt: { lt: now },
        pipelineStage: { isTerminal: false },
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

  // Cold contacts: no activity in 14 days (attention signal)
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

  return {
    tasksDueToday,
    overdueTasks,
    appointmentsToday,
    newLeads,
    hotLeads,
    uncontactedLeads,
    overdueFollowUps,
    coldContacts,
    pipeline: {
      buyers: buyerCount,
      sellers: sellerCount,
      open: openOpportunityCount,
    },
  }
}
