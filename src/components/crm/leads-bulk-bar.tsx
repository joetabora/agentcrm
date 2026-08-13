"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { bulkUpdateOpportunitiesAction } from "@/app/actions"

type Member = { userId: string; name: string }
type Stage = { id: string; name: string }

export function LeadsBulkBar({
  members,
  stages,
}: {
  members: Member[]
  stages: Stage[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string[]>([])
  const [stageId, setStageId] = useState("")
  const [temperature, setTemperature] = useState("")
  const [assignTo, setAssignTo] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = () => {
      const ids = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[name="opportunityId"]:checked'),
      ).map((el) => el.value)
      setSelected(ids)
    }
    document.addEventListener("change", handler)
    return () => document.removeEventListener("change", handler)
  }, [])

  function runBulk() {
    if (selected.length === 0) {
      setError("Select at least one lead")
      return
    }
    if ((stageId || assignTo) && !confirming) {
      setConfirming(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      for (const id of selected) fd.append("opportunityIds", id)
      if (stageId) fd.set("pipelineStageId", stageId)
      if (temperature) fd.set("temperature", temperature)
      if (assignTo) fd.set("assignToUserId", assignTo)
      try {
        await bulkUpdateOpportunitiesAction(fd)
        setConfirming(false)
        setSelected([])
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bulk update failed")
      }
    })
  }

  return (
    <div className="mb-4 rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <p className="mr-2 text-muted-foreground">{selected.length} selected</p>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Stage</span>
          <select
            value={stageId}
            onChange={(e) => {
              setStageId(e.target.value)
              setConfirming(false)
            }}
            className="h-8 rounded-md border bg-background px-2"
          >
            <option value="">—</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Temperature</span>
          <select
            value={temperature}
            onChange={(e) => {
              setTemperature(e.target.value)
              setConfirming(false)
            }}
            className="h-8 rounded-md border bg-background px-2"
          >
            <option value="">—</option>
            <option value="COLD">COLD</option>
            <option value="WARM">WARM</option>
            <option value="HOT">HOT</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Assign</span>
          <select
            value={assignTo}
            onChange={(e) => {
              setAssignTo(e.target.value)
              setConfirming(false)
            }}
            className="h-8 rounded-md border bg-background px-2"
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || (!stageId && !temperature && !assignTo)}
          onClick={runBulk}
          className="h-8 rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-50"
        >
          {confirming ? "Confirm bulk update" : pending ? "Updating…" : "Apply"}
        </button>
        {confirming ? (
          <button
            type="button"
            className="h-8 rounded-md border px-3"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-destructive">{error}</p> : null}
      {confirming ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Confirm stage/assign changes for {selected.length} lead(s).
        </p>
      ) : null}
    </div>
  )
}
