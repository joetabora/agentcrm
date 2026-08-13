import { describe, expect, it } from "vitest"
import {
  buildOutboxItem,
  countOpenOutbox,
  markOutboxDone,
  markOutboxFailed,
  markOutboxSyncing,
  selectDrainableOutbox,
} from "./outbox"

describe("outbox helpers", () => {
  it("builds pending items with payload", () => {
    const item = buildOutboxItem(
      "COMPLETE_TASK",
      { taskId: "t1" },
      new Date("2026-08-12T12:00:00.000Z"),
    )
    expect(item.type).toBe("COMPLETE_TASK")
    expect(item.status).toBe("pending")
    expect(item.payload).toEqual({ taskId: "t1" })
    expect(item.createdAt).toBe("2026-08-12T12:00:00.000Z")
    expect(item.id.length).toBeGreaterThan(8)
  })

  it("selects FIFO drainable items and skips done/syncing", () => {
    const a = buildOutboxItem("COMPLETE_TASK", { taskId: "a" }, new Date("2026-08-12T10:00:00Z"))
    const b = buildOutboxItem(
      "ADD_NOTE",
      { contactId: "c1", body: "hi" },
      new Date("2026-08-12T11:00:00Z"),
    )
    const c = buildOutboxItem("COMPLETE_TASK", { taskId: "c" }, new Date("2026-08-12T09:00:00Z"))
    const done = markOutboxDone(a)
    const syncing = markOutboxSyncing(b)
    const failed = markOutboxFailed(c, "network")

    const ordered = selectDrainableOutbox([done, syncing, failed])
    expect(ordered.map((i) => i.id)).toEqual([failed.id])
  })

  it("orders pending by createdAt", () => {
    const later = buildOutboxItem("COMPLETE_TASK", { taskId: "2" }, new Date("2026-08-12T12:00:00Z"))
    const earlier = buildOutboxItem(
      "COMPLETE_TASK",
      { taskId: "1" },
      new Date("2026-08-12T11:00:00Z"),
    )
    expect(selectDrainableOutbox([later, earlier]).map((i) => i.payload)).toEqual([
      { taskId: "1" },
      { taskId: "2" },
    ])
  })

  it("counts open outbox items", () => {
    const pending = buildOutboxItem("COMPLETE_TASK", { taskId: "a" })
    const failed = markOutboxFailed(buildOutboxItem("COMPLETE_TASK", { taskId: "b" }), "x")
    const done = markOutboxDone(buildOutboxItem("COMPLETE_TASK", { taskId: "c" }))
    expect(countOpenOutbox([pending, failed, done])).toBe(2)
  })
})
