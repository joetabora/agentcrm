import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { OutboxItem, StashRecord } from "./types"

interface OfflineDbSchema extends DBSchema {
  stash: {
    key: string
    value: StashRecord
  }
  outbox: {
    key: string
    value: OutboxItem
    indexes: { "by-created": string }
  }
  meta: {
    key: string
    value: { key: string; value: unknown }
  }
}

const DB_NAME = "joe-re-os-offline"
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<OfflineDbSchema>> | null = null

export function getOfflineDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available")
  }
  if (!dbPromise) {
    dbPromise = openDB<OfflineDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("stash")) {
          db.createObjectStore("stash", { keyPath: "key" })
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const store = db.createObjectStore("outbox", { keyPath: "id" })
          store.createIndex("by-created", "createdAt")
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" })
        }
      },
    })
  }
  return dbPromise
}

export async function putStash<T>(key: string, data: T): Promise<StashRecord<T>> {
  const record: StashRecord<T> = {
    key,
    data,
    savedAt: new Date().toISOString(),
  }
  const db = await getOfflineDb()
  await db.put("stash", record as StashRecord)
  return record
}

export async function getStash<T>(key: string): Promise<StashRecord<T> | undefined> {
  const db = await getOfflineDb()
  return (await db.get("stash", key)) as StashRecord<T> | undefined
}

export async function putOutboxItem(item: OutboxItem): Promise<void> {
  const db = await getOfflineDb()
  await db.put("outbox", item)
}

export async function getOutboxItem(id: string): Promise<OutboxItem | undefined> {
  const db = await getOfflineDb()
  return db.get("outbox", id)
}

export async function listOutboxItems(): Promise<OutboxItem[]> {
  const db = await getOfflineDb()
  return db.getAllFromIndex("outbox", "by-created")
}

export async function deleteOutboxItem(id: string): Promise<void> {
  const db = await getOfflineDb()
  await db.delete("outbox", id)
}
