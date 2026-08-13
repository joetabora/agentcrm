"use client"

import { useState } from "react"
import { toast } from "sonner"
import { addNoteAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { enqueueAddNote, useOnline } from "@/lib/offline/hooks"
import { contactStashKey, type StashedContactDetail } from "@/lib/offline/types"
import { getStash, putStash } from "@/lib/offline/db"

export function ContactNoteForm({ contactId }: { contactId: string }) {
  const online = useOnline()
  const [body, setBody] = useState("")
  const [queuing, setQueuing] = useState(false)

  if (online) {
    return (
      <form action={addNoteAction} className="space-y-2 rounded-lg border p-3">
        <input type="hidden" name="contactId" value={contactId} />
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Add a note…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm">
          Save note
        </Button>
      </form>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={3}
        placeholder="Add a note (queued offline)…"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button
        type="button"
        size="sm"
        disabled={queuing || body.trim().length === 0}
        onClick={() => {
          void (async () => {
            setQueuing(true)
            try {
              const trimmed = body.trim()
              await enqueueAddNote({ contactId, body: trimmed, subject: "Note" })
              const key = contactStashKey(contactId)
              const stash = await getStash<StashedContactDetail>(key)
              if (stash) {
                await putStash(key, {
                  ...stash.data,
                  activities: [
                    {
                      id: `local-${Date.now()}`,
                      type: "NOTE",
                      subject: "Note (queued)",
                      body: trimmed,
                      occurredAt: new Date().toISOString(),
                    },
                    ...stash.data.activities,
                  ],
                })
              }
              setBody("")
              toast.success("Note queued — will sync when online")
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not queue note")
            } finally {
              setQueuing(false)
            }
          })()
        }}
      >
        {queuing ? "Queuing…" : "Queue note"}
      </Button>
    </div>
  )
}
