import { describe, expect, it } from "vitest"
import { addDays, subDays } from "date-fns"
import {
  AGENDA_WEIGHTS,
  rankTasks,
  scoreFollowUp,
  scoreTask,
} from "@/domain/agenda/ranking"
import { nextDueAt, resolveSnoozeUntil } from "@/domain/tasks/service"

describe("agenda ranking", () => {
  const now = new Date("2026-08-12T15:00:00.000Z")

  it("scores overdue HOT urgent tasks highest with transparent reasons", () => {
    const { score, reasons } = scoreTask(
      {
        id: "1",
        title: "Call seller",
        priority: "URGENT",
        dueAt: subDays(now, 2),
        contactId: "c1",
        opportunityId: "o1",
        opportunity: {
          temperature: "HOT",
          firstContactAt: null,
          lastContactAt: null,
          pipelineStage: { isTerminal: false, name: "New" },
        },
      },
      now,
    )
    expect(reasons).toEqual(
      expect.arrayContaining(["Overdue 2d", "Urgent priority", "HOT lead", "Uncontacted lead"]),
    )
    expect(score).toBeGreaterThan(
      AGENDA_WEIGHTS.priority.URGENT + AGENDA_WEIGHTS.dueToday,
    )
  })

  it("ranks urgent overdue above medium due today", () => {
    const ranked = rankTasks(
      [
        {
          id: "low",
          title: "Medium today",
          priority: "MEDIUM",
          dueAt: now,
          contactId: null,
          opportunityId: null,
        },
        {
          id: "high",
          title: "Urgent overdue",
          priority: "URGENT",
          dueAt: subDays(now, 1),
          contactId: null,
          opportunityId: null,
        },
      ],
      now,
    )
    expect(ranked[0]?.id).toBe("high")
    expect(ranked[0]?.reasons.length).toBeGreaterThan(0)
  })

  it("scores overdue follow-ups with reasons", () => {
    const { score, reasons } = scoreFollowUp({
      id: "o1",
      title: "Check in",
      nextActionAt: subDays(now, 1),
      nextAction: "Call back",
      temperature: "HOT",
      contactId: "c1",
      firstContactAt: null,
      lastContactAt: null,
    })
    expect(score).toBeGreaterThan(0)
    expect(reasons).toContain("Next action overdue")
    expect(reasons).toContain("HOT lead")
  })
})

describe("snooze + recurrence helpers", () => {
  it("resolves snooze presets", () => {
    const base = new Date("2026-08-12T15:00:00.000Z")
    // resolveSnoozeUntil uses Date.now internally — check shape via custom
    const custom = new Date("2026-08-20T12:00:00.000Z")
    expect(resolveSnoozeUntil("custom", custom).toISOString()).toBe(custom.toISOString())
    expect(() => resolveSnoozeUntil("custom")).toThrow(/Custom snooze/)
    expect(resolveSnoozeUntil("1h").getTime()).toBeGreaterThan(base.getTime() - 60_000)
  })

  it("advances due dates by recurrence rule", () => {
    const from = new Date("2026-08-12T15:00:00.000Z")
    expect(nextDueAt(from, "NONE")).toBeNull()
    expect(nextDueAt(from, "DAILY", from)?.toISOString()).toBe(addDays(from, 1).toISOString())
    expect(nextDueAt(from, "WEEKLY", from)?.getTime()).toBeGreaterThan(from.getTime())
    expect(nextDueAt(from, "MONTHLY", from)?.getTime()).toBeGreaterThan(from.getTime())
  })
})
