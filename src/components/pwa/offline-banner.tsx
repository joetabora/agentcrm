"use client"

import { format } from "date-fns"
import { useOnline } from "@/lib/offline/hooks"

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null

  return (
    <div
      role="status"
      className="border-b border-warning/30 bg-warning/15 px-4 py-2 text-center text-sm text-warning-foreground"
    >
      You are offline. Agenda and contacts may be stale. Completing a task or adding a note will
      queue until you reconnect.
    </div>
  )
}

export function StaleBadge({ savedAt }: { savedAt: string | null }) {
  if (!savedAt) return null
  return (
    <span className="inline-flex items-center rounded-md border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
      Offline · saved {format(new Date(savedAt), "MMM d, h:mm a")}
    </span>
  )
}
