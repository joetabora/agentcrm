import Link from "next/link"
import { format, startOfDay } from "date-fns"
import { getDashboardData } from "@/domain/dashboard/service"
import { listThreads } from "@/domain/comms/service"
import { matchContactsForProperty } from "@/domain/properties/service"
import { requireOrgContext } from "@/server/session"
import { AgendaOfflineSection } from "@/components/pwa/agenda-offline-section"
import { AIInsight } from "@/components/patterns/ai"
import { Metric, PageShell, SectionHeader } from "@/components/patterns/page"
import { StatusBadge, TemperatureBadge } from "@/components/patterns/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { StashedAgendaItem } from "@/lib/offline/types"
import { prisma } from "@/lib/db"

export default async function HomePage() {
  const ctx = await requireOrgContext()
  const todayStart = startOfDay(new Date())
  const [data, threads, recentListings] = await Promise.all([
    getDashboardData(ctx.organization.id, ctx.user.id),
    listThreads(ctx.organization.id, { take: 8 }),
    prisma.property.findMany({
      where: {
        organizationId: ctx.organization.id,
        listedAt: { gte: todayStart },
      },
      take: 3,
      orderBy: { listedAt: "desc" },
    }),
  ])

  const openTasksToday = data.rankedAgenda.filter((i) => i.kind === "task").length
  const firstName = ctx.user.name.split(" ")[0] || "there"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

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

  const matchCards: Array<{
    contactName: string
    contactId: string
    propertyLabel: string
    propertyId: string
    score: number
  }> = []

  for (const listing of recentListings) {
    const matches = await matchContactsForProperty(ctx.organization.id, listing.id, 2)
    for (const m of matches.slice(0, 1)) {
      matchCards.push({
        contactName: `${m.contact.firstName} ${m.contact.lastName}`,
        contactId: m.contact.id,
        propertyLabel: listing.line1,
        propertyId: listing.id,
        score: Math.round(m.score),
      })
    }
  }

  const reengage = data.coldContacts.slice(0, 2)

  return (
    <PageShell
      title={`${greeting}, ${firstName}.`}
      description={`Here’s what needs your attention · ${format(new Date(), "EEEE, MMM d")}`}
      actions={
        <>
          <Link href="/app/tasks" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Tasks
          </Link>
          <Link href="/app/leads/new" className={cn(buttonVariants({ size: "sm" }))}>
            New lead
          </Link>
        </>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Tasks due" value={openTasksToday} hint="On today’s agenda" />
        <Metric
          label="Appointments"
          value={data.appointmentsToday.length}
          hint="Scheduled today"
        />
        <Metric label="New leads" value={data.newLeads.length} hint="Created today" />
        <Metric label="Messages" value={threads.length} hint="Recent threads" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section>
            <SectionHeader title="Attention required" />
            <Card className="shadow-[var(--shadow-card)]">
              <CardContent className="divide-y p-0">
                {data.overdueTasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Call overdue</p>
                      <p className="text-xs text-muted-foreground">
                        {t.title}
                        {t.contact
                          ? ` · ${t.contact.firstName} ${t.contact.lastName}`
                          : ""}
                        {t.dueAt ? ` · due ${format(t.dueAt, "MMM d")}` : ""}
                      </p>
                    </div>
                    <StatusBadge tone="warning">Overdue</StatusBadge>
                  </div>
                ))}
                {data.hotLeads.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Hot lead needs follow-up</p>
                      <p className="text-xs text-muted-foreground">
                        {o.contact.firstName} {o.contact.lastName} · {o.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TemperatureBadge value={o.temperature} />
                      <Link
                        href={`/app/leads/${o.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
                {data.overdueTasks.length === 0 && data.hotLeads.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    Nothing urgent right now. Your agenda below is clear to work.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <AgendaOfflineSection items={agendaItems} />
        </div>

        <div className="space-y-6">
          <section>
            <SectionHeader title="AI opportunities" />
            <p className="mb-3 text-sm text-muted-foreground">Things worth your attention.</p>
            <div className="space-y-3">
              {matchCards.map((m) => (
                <AIInsight
                  key={`${m.contactId}-${m.propertyId}`}
                  title="High-value buyer opportunity"
                  subtitle={`${m.score}% match`}
                  body={
                    <p>
                      <span className="font-medium text-foreground">{m.contactName}</span> matches{" "}
                      <span className="font-medium text-foreground">{m.propertyLabel}</span>.
                    </p>
                  }
                  actions={
                    <>
                      <Link
                        href={`/app/properties/${m.propertyId}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        View property
                      </Link>
                      <Link
                        href={`/app/contacts/${m.contactId}`}
                        className={cn(buttonVariants({ size: "sm" }))}
                      >
                        Draft message
                      </Link>
                    </>
                  }
                />
              ))}
              {reengage.map((c) => (
                <AIInsight
                  key={c.id}
                  title="Re-engagement opportunity"
                  body={
                    <p>
                      <span className="font-medium text-foreground">
                        {c.firstName} {c.lastName}
                      </span>{" "}
                      has been quiet
                      {c.lastContactedAt
                        ? ` since ${format(c.lastContactedAt, "MMM d")}`
                        : " with no recorded contact"}
                      .
                    </p>
                  }
                  actions={
                    <Link
                      href={`/app/contacts/${c.id}`}
                      className={cn(buttonVariants({ size: "sm" }))}
                    >
                      Contact {c.firstName}
                    </Link>
                  }
                />
              ))}
              {matchCards.length === 0 && reengage.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">No AI opportunities yet</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    As buyer preferences and listing activity accumulate, recommendations will appear
                    here.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </section>

          <section>
            <SectionHeader
              title="Pipeline"
              action={
                <Link href="/app/pipeline" className="text-xs font-medium text-primary hover:underline">
                  View board
                </Link>
              }
            />
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Open" value={data.pipeline.open} />
              <Metric label="Buyers" value={data.pipeline.buyers} />
              <Metric label="Sellers" value={data.pipeline.sellers} />
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  )
}
