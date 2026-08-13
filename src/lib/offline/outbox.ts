import type { AddNotePayload, CompleteTaskPayload, OutboxItem, OutboxType } from "./types"

export function createOutboxId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `ob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function buildOutboxItem(
  type: OutboxType,
  payload: CompleteTaskPayload | AddNotePayload,
  now = new Date(),
): OutboxItem {
  return {
    id: createOutboxId(),
    type,
    payload,
    createdAt: now.toISOString(),
    status: "pending",
  }
}

/** FIFO among unfinished items (pending / syncing / failed). */
export function selectDrainableOutbox(items: OutboxItem[]): OutboxItem[] {
  return items
    .filter((item) => item.status === "pending" || item.status === "failed")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function markOutboxSyncing(item: OutboxItem): OutboxItem {
  return { ...item, status: "syncing", error: undefined }
}

export function markOutboxDone(item: OutboxItem): OutboxItem {
  return { ...item, status: "done", error: undefined }
}

export function markOutboxFailed(item: OutboxItem, error: string): OutboxItem {
  return { ...item, status: "failed", error }
}

export function countOpenOutbox(items: OutboxItem[]): number {
  return items.filter((item) => item.status === "pending" || item.status === "failed" || item.status === "syncing")
    .length
}
