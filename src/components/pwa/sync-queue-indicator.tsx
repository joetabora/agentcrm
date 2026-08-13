"use client"

import { CloudOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  dismissOutboxItem,
  drainOutbox,
  retryOutboxItem,
  useOnline,
  useOutboxQueue,
} from "@/lib/offline/hooks"

export function SyncQueueIndicator() {
  const online = useOnline()
  const { items, openCount } = useOutboxQueue()
  const open = items.filter(
    (i) => i.status === "pending" || i.status === "failed" || i.status === "syncing",
  )

  if (openCount === 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
        {online ? <RefreshCw className="size-3" /> : <CloudOff className="size-3" />}
        Sync queue {openCount}
      </span>
      {online ? (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void drainOutbox()}>
          Sync now
        </Button>
      ) : null}
      {open.some((i) => i.status === "failed") ? (
        <div className="hidden max-w-[12rem] truncate text-[10px] text-destructive sm:block">
          {open.find((i) => i.status === "failed")?.error}
        </div>
      ) : null}
      {open
        .filter((i) => i.status === "failed")
        .slice(0, 1)
        .map((i) => (
          <div key={i.id} className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => void retryOutboxItem(i.id)}
            >
              Retry
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => void dismissOutboxItem(i.id)}
            >
              Dismiss
            </Button>
          </div>
        ))}
    </div>
  )
}
