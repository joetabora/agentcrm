"use client"

import Link from "next/link"
import { format } from "date-fns"
import { EmptyState } from "@/components/crm/shared"
import { TaskActionBar } from "@/components/crm/task-action-bar"
import { StaleBadge } from "@/components/pwa/offline-banner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useOfflineStash, useOnline } from "@/lib/offline/hooks"
import { STASH_AGENDA, type StashedAgendaItem } from "@/lib/offline/types"

export function AgendaOfflineSection({ items }: { items: StashedAgendaItem[] }) {
  const online = useOnline()
  const { data, savedAt, showingStash } = useOfflineStash(STASH_AGENDA, items, online)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Today&apos;s agenda</h2>
        {showingStash ? <StaleBadge savedAt={savedAt} /> : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Do this next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.length === 0 ? (
            <EmptyState
              title="Agenda clear"
              description="Create a task or set a lead next action."
              actionHref="/app/tasks"
              actionLabel="Open tasks"
            />
          ) : (
            data.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.reasons.join(" · ")}
                      <span className="ml-2 tabular-nums">score {item.score}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.kind === "follow_up" ? (
                        <Badge variant="outline">Follow-up</Badge>
                      ) : (
                        <Badge variant="outline">{item.priority}</Badge>
                      )}
                      {item.dueAt ? (
                        <span>Due {format(new Date(item.dueAt), "MMM d, h:mm a")}</span>
                      ) : null}
                      {item.contactId ? (
                        <Link
                          href={`/app/contacts/${item.contactId}`}
                          className="hover:underline"
                        >
                          Contact
                        </Link>
                      ) : null}
                      {item.opportunityId ? (
                        <Link
                          href={`/app/leads/${item.opportunityId}`}
                          className="hover:underline"
                        >
                          Lead
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
                {item.kind === "task" ? (
                  <div className="mt-2">
                    <TaskActionBar taskId={item.id} redirectTo="/app" compact />
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
