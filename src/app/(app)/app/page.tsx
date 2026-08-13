import Link from "next/link"
import { format } from "date-fns"
import { getDashboardData } from "@/domain/dashboard/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader, TemperatureBadge } from "@/components/crm/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const data = await getDashboardData(ctx.organization.id)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="What should I do today?"
        actions={
          <>
            <Link
              href="/app/contacts/new"
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
            >
              New contact
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
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Today</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks due</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.tasksDueToday.length === 0 ? (
                <EmptyState
                  title="No tasks due today"
                  description="Create a task when you have follow-up work."
                  actionHref="/app/tasks"
                  actionLabel="Open tasks"
                />
              ) : (
                data.tasksDueToday.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{t.title}</span>
                    {t.contact ? (
                      <Link
                        href={`/app/contacts/${t.contact.id}`}
                        className="shrink-0 text-muted-foreground hover:underline"
                      >
                        {t.contact.firstName} {t.contact.lastName}
                      </Link>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.appointmentsToday.length === 0 ? (
                <EmptyState
                  title="No appointments today"
                  description="Scheduled meetings will appear here."
                />
              ) : (
                data.appointmentsToday.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{a.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {format(a.startsAt, "h:mm a")}
                    </span>
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
                    <Link href={`/app/contacts/${o.contactId}`} className="truncate font-medium hover:underline">
                      {o.title}
                    </Link>
                    <TemperatureBadge value={o.temperature} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

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
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{t.title}</span>
                    <Badge variant="destructive">Overdue</Badge>
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
                    <Link href={`/app/contacts/${o.contactId}`} className="truncate hover:underline">
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
                      <Link href={`/app/contacts/${o.contactId}`} className="hover:underline">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI-ranked opportunities arrive in a later phase. Hot leads and overdue follow-ups
                above are computed from your real CRM data.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
