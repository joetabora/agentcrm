"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import {
  cancelTaskAction,
  completeTaskAction,
  rescheduleTaskAction,
  snoozeTaskAction,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { enqueueCompleteTask, useOnline } from "@/lib/offline/hooks"

export function TaskActionBar({
  taskId,
  redirectTo = "/app/tasks",
  compact = false,
}: {
  taskId: string
  redirectTo?: string
  compact?: boolean
}) {
  const online = useOnline()
  const router = useRouter()
  const [showCustomSnooze, setShowCustomSnooze] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [queuing, setQueuing] = useState(false)

  async function onCompleteOffline() {
    setQueuing(true)
    try {
      await enqueueCompleteTask(taskId)
      toast.success("Queued — will sync when online")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not queue")
    } finally {
      setQueuing(false)
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "justify-end" : ""}`}>
      {online ? (
        <form action={completeTaskAction}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button type="submit" size="sm" variant="outline">
            Done
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={queuing}
          onClick={() => void onCompleteOffline()}
        >
          {queuing ? "Queuing…" : "Done (queue)"}
        </Button>
      )}

      <form action={snoozeTaskAction} className="inline-flex gap-1">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="1h" />
        <Button type="submit" size="sm" variant="ghost" disabled={!online}>
          1h
        </Button>
      </form>
      <form action={snoozeTaskAction} className="inline-flex">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="tomorrow" />
        <Button type="submit" size="sm" variant="ghost" disabled={!online}>
          Tomorrow
        </Button>
      </form>
      <form action={snoozeTaskAction} className="inline-flex">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="3d" />
        <Button type="submit" size="sm" variant="ghost" disabled={!online}>
          +3d
        </Button>
      </form>
      <form action={snoozeTaskAction} className="inline-flex">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="next_week" />
        <Button type="submit" size="sm" variant="ghost" disabled={!online}>
          Next week
        </Button>
      </form>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!online}
        onClick={() => {
          setShowCustomSnooze((v) => !v)
          setShowReschedule(false)
        }}
      >
        Snooze…
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!online}
        onClick={() => {
          setShowReschedule((v) => !v)
          setShowCustomSnooze(false)
        }}
      >
        Reschedule
      </Button>
      <form action={cancelTaskAction}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Button type="submit" size="sm" variant="ghost" disabled={!online}>
          Cancel
        </Button>
      </form>

      {showCustomSnooze ? (
        <form action={snoozeTaskAction} className="flex w-full items-center gap-2 pt-1">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="preset" value="custom" />
          <Input name="snoozedUntil" type="datetime-local" required className="h-8 max-w-xs" />
          <Button type="submit" size="sm">
            Snooze
          </Button>
        </form>
      ) : null}

      {showReschedule ? (
        <form action={rescheduleTaskAction} className="flex w-full items-center gap-2 pt-1">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Input name="dueAt" type="datetime-local" required className="h-8 max-w-xs" />
          <Button type="submit" size="sm">
            Set due
          </Button>
        </form>
      ) : null}
    </div>
  )
}
