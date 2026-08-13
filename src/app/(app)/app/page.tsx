import Link from "next/link"
import { format } from "date-fns"
import { getDashboardData } from "@/domain/dashboard/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader, TemperatureBadge } from "@/components/crm/shared"
import { TaskActionBar } from "@/components/crm/task-action-bar"
import { AgendaOfflineSection } from "@/components/pwa/agenda-offline-section"
import {
  cancelAppointmentAction,
  completeAppointmentAction,
} from "@/app/actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { StashedAgendaItem } from "@/lib/offline/types"

export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const data = await getDashboardData(ctx.organization.id, ctx.user.id)

  const agendaItems: StashedAgendaItem[] = data.rankedAgenda.map((item) => ({
    kind: item.kind,
    id: item.id,
    title: item.title,
    score: item.score,
    reasons: item.reasons,
    dueAt: item.dueAt ? item.dueAt.toISOString() : null,
    contactId: item.contactId,
    opportunityId: item.opportunityId,
    priority: item.priority,
  }))

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Ranked agenda — scores are deterministic and explained"
        actions={
          <>
            <Link
              href="/app/tasks"
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
            >
              Manage tasks
            </Link>
            <Link
              href="/app/leads/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
            >
              New lead
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open pipeline</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.pipeline.open}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Buyers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.pipeline.buyers}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sellers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.pipeline.sellers}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <AgendaOfflineSection items={agendaItems} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appointments today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.appointmentsToday.length === 0 ? (
                <EmptyState
                  title="No appointments today"
                  description="Scheduled meetings will appear here."
                />
              ) : (
                data.appointmentsToday.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">{a.title}</span>
                      <span className="ml-2 text-muted-foreground">
                        {format(a.startsAt, "h:mm a")}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <form action={completeAppointmentAction}>
                        <input type="hidden" name="appointmentId" value={a.id} />
                        <input type="hidden" name="redirectTo" value="/app" />
                        <Button type="submit" size="sm" variant="outline">
                          Done
                        </Button>
                      </form>
                      <form action={cancelAppointmentAction}>
                        <input type="hidden" name="appointmentId" value={a.id} />
                        <input type="hidden" name="redirectTo" value="/app" />
                        <Button type="submit" size="sm" variant="ghost">
                          Cancel
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">New leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.newLeads.length === 0 ? (
                <EmptyState
                  title="No new leads today"
                  description="Leads created today show up here."
                  actionHref="/app/leads/new"
                  actionLabel="Add lead"
                />
              ) : (
                data.newLeads.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/leads/${o.id}`} className="truncate font-medium hover:underline">
                      {o.title}
                    </Link>
                    <TemperatureBadge value={o.temperature} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Attention required</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overdue tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.overdueTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing overdue.</p>
              ) : (
                data.overdueTasks.map((t) => (
                  <div key={t.id} className="space-y-2 rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{t.title}</span>
                      <Badge variant="destructive">Overdue</Badge>
                    </div>
                    <TaskActionBar taskId={t.id} redirectTo="/app" compact />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overdue follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.overdueFollowUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No overdue next actions.</p>
              ) : (
                data.overdueFollowUps.map((o) => (
                  <div key={o.id} className="text-sm">
                    <Link href={`/app/leads/${o.id}`} className="font-medium hover:underline">
                      {o.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{o.reasons.join(" · ")}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hot leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.hotLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hot leads right now.</p>
              ) : (
                data.hotLeads.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/leads/${o.id}`} className="truncate hover:underline">
                      {o.contact.firstName} {o.contact.lastName}
                    </Link>
                    <span className="text-muted-foreground">{o.pipelineStage.name}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uncontacted / cold</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.uncontactedLeads.length === 0 && data.coldContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inbox looks clear.</p>
              ) : (
                <>
                  {data.uncontactedLeads.map((o) => (
                    <div key={o.id} className="text-sm">
                      <Link href={`/app/leads/${o.id}`} className="hover:underline">
                        {o.title}
                      </Link>
                      <span className="text-muted-foreground"> · uncontacted</span>
                    </div>
                  ))}
                  {data.coldContacts.map((c) => (
                    <div key={c.id} className="text-sm">
                      <Link href={`/app/contacts/${c.id}`} className="hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                      <span className="text-muted-foreground"> · no recent contact</span>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
