"use client"

import { format } from "date-fns"
import { StaleBadge } from "@/components/pwa/offline-banner"
import { ContactNoteForm } from "@/components/pwa/contact-note-form"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/crm/shared"
import { useOfflineStash, useOnline } from "@/lib/offline/hooks"
import { contactStashKey, type StashedContactDetail } from "@/lib/offline/types"

export function ContactDetailOfflineBridge({
  detail,
  children,
}: {
  detail: StashedContactDetail
  children: React.ReactNode
}) {
  const online = useOnline()
  const { data, savedAt, showingStash } = useOfflineStash(
    contactStashKey(detail.id),
    detail,
    online,
  )

  if (online) {
    return <>{children}</>
  }

  const view = showingStash ? data : detail

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StaleBadge savedAt={savedAt ?? new Date().toISOString()} />
        <span className="text-xs text-muted-foreground">
          Email, SMS, and other edits need a connection.
        </span>
      </div>
      <div className="border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {view.firstName} {view.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {view.lifecycleStage}
          {view.source ? ` · Source: ${view.source}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {view.email ? <span>{view.email}</span> : null}
          {view.phone ? <span>{view.phone}</span> : null}
        </div>
      </div>
      {view.notesSummary ? (
        <p className="text-sm text-muted-foreground">{view.notesSummary}</p>
      ) : null}
      <ContactNoteForm contactId={view.id} />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Timeline</h2>
        {view.activities.length === 0 ? (
          <EmptyState title="No activity" description="No notes cached for this contact." />
        ) : (
          <ul className="space-y-3">
            {view.activities.map((a) => (
              <li key={a.id} className="border-l-2 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{a.type}</Badge>
                  <span>{format(new Date(a.occurredAt), "MMM d, yyyy h:mm a")}</span>
                </div>
                {a.subject ? <p className="text-sm font-medium">{a.subject}</p> : null}
                {a.body ? <p className="text-sm whitespace-pre-wrap">{a.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
