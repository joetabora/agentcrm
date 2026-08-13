"use client"

import { useState } from "react"
import {
  cancelTaskAction,
  completeTaskAction,
  rescheduleTaskAction,
  snoozeTaskAction,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function TaskActionBar({
  taskId,
  redirectTo = "/app/tasks",
  compact = false,
}: {
  taskId: string
  redirectTo?: string
  compact?: boolean
}) {
  const [showCustomSnooze, setShowCustomSnooze] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)

  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "justify-end" : ""}`}>
      <form action={completeTaskAction}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Button type="submit" size="sm" variant="outline">
          Done
        </Button>
      </form>

      <form action={snoozeTaskAction} className="inline-flex gap-1">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="1h" />
        <Button type="submit" size="sm" variant="ghost">
          1h
        </Button>
      </form>
      <form action={snoozeTaskAction} className="inline-flex">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="tomorrow" />
        <Button type="submit" size="sm" variant="ghost">
          Tomorrow
        </Button>
      </form>
      <form action={snoozeTaskAction} className="inline-flex">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="3d" />
        <Button type="submit" size="sm" variant="ghost">
          +3d
        </Button>
      </form>
      <form action={snoozeTaskAction} className="inline-flex">
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="preset" value="next_week" />
        <Button type="submit" size="sm" variant="ghost">
          Next week
        </Button>
      </form>

      <Button
        type="button"
        size="sm"
        variant="ghost"
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
        <Button type="submit" size="sm" variant="ghost">
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
