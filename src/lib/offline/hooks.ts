"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import {
  deleteOutboxItem,
  getOutboxItem,
  listOutboxItems,
  putOutboxItem,
  putStash,
  getStash,
} from "./db"
import {
  buildOutboxItem,
  countOpenOutbox,
  markOutboxDone,
  markOutboxFailed,
  markOutboxSyncing,
  selectDrainableOutbox,
} from "./outbox"
import type {
  AddNotePayload,
  CompleteTaskPayload,
  OutboxItem,
  StashRecord,
  StashedAgendaItem,
} from "./types"
import { STASH_AGENDA } from "./types"
import {
  syncAddNoteAction,
  syncCompleteTaskAction,
} from "@/app/actions"

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange)
  window.addEventListener("offline", onStoreChange)
  return () => {
    window.removeEventListener("online", onStoreChange)
    window.removeEventListener("offline", onStoreChange)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

function getServerOnlineSnapshot() {
  return true
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot)
}

type OutboxListener = () => void
const outboxListeners = new Set<OutboxListener>()

function notifyOutbox() {
  for (const listener of outboxListeners) listener()
}

export function subscribeOutbox(listener: OutboxListener) {
  outboxListeners.add(listener)
  return () => {
    outboxListeners.delete(listener)
  }
}

let draining = false

export async function enqueueCompleteTask(taskId: string): Promise<OutboxItem> {
  const item = buildOutboxItem("COMPLETE_TASK", { taskId })
  await putOutboxItem(item)
  const stash = await getStash<StashedAgendaItem[]>(STASH_AGENDA)
  if (stash) {
    const next = stash.data.filter((row) => !(row.kind === "task" && row.id === taskId))
    await putStash(STASH_AGENDA, next)
  }
  notifyOutbox()
  return item
}

export async function enqueueAddNote(payload: AddNotePayload): Promise<OutboxItem> {
  const item = buildOutboxItem("ADD_NOTE", payload)
  await putOutboxItem(item)
  notifyOutbox()
  return item
}

async function syncOne(item: OutboxItem): Promise<void> {
  await putOutboxItem(markOutboxSyncing(item))
  notifyOutbox()

  try {
    if (item.type === "COMPLETE_TASK") {
      const payload = item.payload as CompleteTaskPayload
      const result = await syncCompleteTaskAction(payload.taskId)
      if (!result.ok) throw new Error(result.error)
    } else if (item.type === "ADD_NOTE") {
      const payload = item.payload as AddNotePayload
      const result = await syncAddNoteAction(payload)
      if (!result.ok) throw new Error(result.error)
    } else {
      throw new Error("Unsupported outbox type")
    }
    await putOutboxItem(markOutboxDone(item))
    await deleteOutboxItem(item.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed"
    const current = (await getOutboxItem(item.id)) ?? item
    await putOutboxItem(markOutboxFailed(current, message))
  }
  notifyOutbox()
}

export async function drainOutbox(): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine || draining) return
  draining = true
  try {
    const items = await listOutboxItems()
    for (const item of selectDrainableOutbox(items)) {
      if (!navigator.onLine) break
      await syncOne(item)
    }
  } finally {
    draining = false
    notifyOutbox()
  }
}

export async function retryOutboxItem(id: string): Promise<void> {
  const item = await getOutboxItem(id)
  if (!item) return
  await putOutboxItem({ ...item, status: "pending", error: undefined })
  notifyOutbox()
  await drainOutbox()
}

export async function dismissOutboxItem(id: string): Promise<void> {
  await deleteOutboxItem(id)
  notifyOutbox()
}

export function useOutboxQueue() {
  const [items, setItems] = useState<OutboxItem[]>([])
  const [openCount, setOpenCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const next = await listOutboxItems()
      setItems(next)
      setOpenCount(countOpenOutbox(next))
    } catch {
      setItems([])
      setOpenCount(0)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return subscribeOutbox(() => {
      void refresh()
    })
  }, [refresh])

  return { items, openCount, refresh, retryOutboxItem, dismissOutboxItem, drainOutbox }
}

export function useStashOnLoad<T>(key: string, data: T, online: boolean) {
  useEffect(() => {
    if (!online) return
    void putStash(key, data)
  }, [key, data, online])
}

export function useOfflineStash<T>(key: string, liveData: T, online: boolean) {
  const [record, setRecord] = useState<StashRecord<T> | null>(null)

  useStashOnLoad(key, liveData, online)

  useEffect(() => {
    if (online) {
      setRecord(null)
      return
    }
    const load = () => {
      void getStash<T>(key).then((row) => {
        if (row) setRecord(row)
      })
    }
    load()
    return subscribeOutbox(load)
  }, [key, online])

  const showingStash = !online && record != null
  const data = showingStash ? record.data : liveData
  const savedAt = showingStash ? record.savedAt : null

  return { data, savedAt, showingStash }
}
