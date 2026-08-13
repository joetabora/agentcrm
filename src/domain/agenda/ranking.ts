import type { LeadTemperature, TaskPriority } from "@/generated/prisma/client"
import { differenceInCalendarDays, isToday, startOfDay } from "date-fns"

export type RankableTaskInput = {
  id: string
  title: string
  priority: TaskPriority
  dueAt: Date | null
  contactId: string | null
  opportunityId: string | null
  contact?: {
    lastContactedAt: Date | null
  } | null
  opportunity?: {
    temperature: LeadTemperature
    firstContactAt: Date | null
    lastContactAt: Date | null
    pipelineStage?: { isTerminal: boolean; name: string } | null
  } | null
}

export type RankedAgendaItem = {
  kind: "task" | "follow_up"
  id: string
  title: string
  score: number
  reasons: string[]
  dueAt: Date | null
  contactId: string | null
  opportunityId: string | null
  priority?: TaskPriority
}

/** Fixed weights — documented for transparent prioritization (no AI). */
export const AGENDA_WEIGHTS = {
  overduePerDay: 25,
  overdueCap: 150,
  dueToday: 40,
  dueSoonWithin3Days: 15,
  priority: {
    LOW: 5,
    MEDIUM: 15,
    HIGH: 35,
    URGENT: 55,
  } satisfies Record<TaskPriority, number>,
  hotLead: 40,
  warmLead: 15,
  uncontactedLead: 30,
  openPipeline: 10,
  followUpOverdue: 45,
} as const

export function scoreTask(
  task: RankableTaskInput,
  now = new Date(),
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (task.dueAt) {
    const dueDay = startOfDay(task.dueAt)
    const today = startOfDay(now)
    if (dueDay < today) {
      const days = Math.max(1, differenceInCalendarDays(today, dueDay))
      const overduePts = Math.min(AGENDA_WEIGHTS.overdueCap, days * AGENDA_WEIGHTS.overduePerDay)
      score += overduePts
      reasons.push(`Overdue ${days}d`)
    } else if (isToday(task.dueAt)) {
      score += AGENDA_WEIGHTS.dueToday
      reasons.push("Due today")
    } else {
      const daysUntil = differenceInCalendarDays(dueDay, today)
      if (daysUntil <= 3) {
        score += AGENDA_WEIGHTS.dueSoonWithin3Days
        reasons.push(`Due in ${daysUntil}d`)
      }
    }
  }

  const prioPts = AGENDA_WEIGHTS.priority[task.priority]
  score += prioPts
  if (task.priority === "URGENT" || task.priority === "HIGH") {
    reasons.push(`${task.priority.charAt(0)}${task.priority.slice(1).toLowerCase()} priority`)
  } else if (task.priority === "MEDIUM" && reasons.length === 0) {
    reasons.push("Medium priority")
  }

  const opp = task.opportunity
  if (opp) {
    if (opp.temperature === "HOT") {
      score += AGENDA_WEIGHTS.hotLead
      reasons.push("HOT lead")
    } else if (opp.temperature === "WARM") {
      score += AGENDA_WEIGHTS.warmLead
      reasons.push("WARM lead")
    }
    if (!opp.firstContactAt || !opp.lastContactAt) {
      score += AGENDA_WEIGHTS.uncontactedLead
      reasons.push("Uncontacted lead")
    }
    if (opp.pipelineStage && !opp.pipelineStage.isTerminal) {
      score += AGENDA_WEIGHTS.openPipeline
    }
  } else if (task.contact && !task.contact.lastContactedAt) {
    score += Math.floor(AGENDA_WEIGHTS.uncontactedLead / 2)
    reasons.push("Never contacted")
  }

  if (reasons.length === 0) reasons.push("Open task")

  return { score, reasons }
}

export function scoreFollowUp(input: {
  id: string
  title: string
  nextActionAt: Date | null
  nextAction: string | null
  temperature: LeadTemperature
  contactId: string
  firstContactAt: Date | null
  lastContactAt: Date | null
}): { score: number; reasons: string[] } {
  let score = AGENDA_WEIGHTS.followUpOverdue
  const reasons: string[] = ["Next action overdue"]
  if (input.temperature === "HOT") {
    score += AGENDA_WEIGHTS.hotLead
    reasons.push("HOT lead")
  } else if (input.temperature === "WARM") {
    score += AGENDA_WEIGHTS.warmLead
    reasons.push("WARM lead")
  }
  if (!input.firstContactAt || !input.lastContactAt) {
    score += AGENDA_WEIGHTS.uncontactedLead
    reasons.push("Uncontacted")
  }
  return { score, reasons }
}

export function rankTasks(tasks: RankableTaskInput[], now = new Date()): RankedAgendaItem[] {
  return tasks
    .map((task) => {
      const { score, reasons } = scoreTask(task, now)
      return {
        kind: "task" as const,
        id: task.id,
        title: task.title,
        score,
        reasons,
        dueAt: task.dueAt,
        contactId: task.contactId,
        opportunityId: task.opportunityId,
        priority: task.priority,
      }
    })
    .sort((a, b) => b.score - a.score || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))
}

export function mergeAgenda(
  tasks: RankedAgendaItem[],
  followUps: RankedAgendaItem[],
  limit = 25,
): RankedAgendaItem[] {
  return [...tasks, ...followUps]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
