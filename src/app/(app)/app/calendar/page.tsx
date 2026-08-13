import Link from "next/link"
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { listCalendarEvents } from "@/domain/calendar/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageShell, SectionHeader } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const view = sp.view === "day" || sp.view === "week" ? sp.view : "month"
  const anchor = sp.date ? new Date(sp.date) : new Date()
  const safeAnchor = Number.isNaN(anchor.getTime()) ? new Date() : anchor

  const range =
    view === "day"
      ? { from: safeAnchor, to: safeAnchor }
      : view === "week"
        ? {
            from: startOfWeek(safeAnchor),
            to: endOfWeek(safeAnchor),
          }
        : {
            from: startOfWeek(startOfMonth(safeAnchor)),
            to: endOfWeek(endOfMonth(safeAnchor)),
          }

  const events = await listCalendarEvents(ctx.organization.id, range)
  const days =
    view === "day"
      ? [safeAnchor]
      : eachDayOfInterval({ start: range.from, end: range.to })

  const prev =
    view === "day"
      ? addDays(safeAnchor, -1)
      : view === "week"
        ? addDays(safeAnchor, -7)
        : addDays(startOfMonth(safeAnchor), -1)
  const next =
    view === "day"
      ? addDays(safeAnchor, 1)
      : view === "week"
        ? addDays(safeAnchor, 7)
        : addDays(endOfMonth(safeAnchor), 1)

  function hrefFor(date: Date, v = view) {
    return `/app/calendar?view=${v}&date=${format(date, "yyyy-MM-dd")}`
  }

  return (
    <PageShell
      title="Calendar"
      description="Appointments, task due dates, and transaction deadlines."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={hrefFor(prev)} className="rounded-lg border px-2.5 py-1 text-sm">
            Prev
          </Link>
          <Link href={hrefFor(new Date())} className="rounded-lg border px-2.5 py-1 text-sm">
            Today
          </Link>
          <Link href={hrefFor(next)} className="rounded-lg border px-2.5 py-1 text-sm">
            Next
          </Link>
          {(["day", "week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={hrefFor(safeAnchor, v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize",
                view === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {v}
            </Link>
          ))}
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        {format(range.from, "MMM d, yyyy")}
        {view !== "day" ? ` – ${format(range.to, "MMM d, yyyy")}` : ""}
      </p>

      {events.length === 0 ? (
        <EmptyState
          title="Nothing scheduled in this range"
          description="Appointments, due tasks, and transaction deadlines will appear on this calendar."
          actionHref="/app/tasks"
          actionLabel="Manage tasks"
        />
      ) : null}

      <div
        className={cn(
          "grid gap-2",
          view === "month" && "grid-cols-2 md:grid-cols-4 xl:grid-cols-7",
          view === "week" && "grid-cols-1 md:grid-cols-7",
          view === "day" && "grid-cols-1",
        )}
      >
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(e.startsAt, day))
          return (
            <Card
              key={day.toISOString()}
              className={cn(
                "min-h-28 shadow-[var(--shadow-card)]",
                view === "month" && !isSameMonth(day, safeAnchor) && "opacity-50",
              )}
            >
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {format(day, view === "month" ? "d" : "EEE d")}
                  </p>
                  {isSameDay(day, new Date()) ? <StatusBadge tone="info">Today</StatusBadge> : null}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map((e) => (
                    <Link
                      key={e.id}
                      href={e.href}
                      className="block rounded-md border px-2 py-1.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <div className="flex items-center gap-1">
                        <StatusBadge
                          tone={
                            e.kind === "deadline"
                              ? "warning"
                              : e.kind === "appointment"
                                ? "info"
                                : "default"
                          }
                        >
                          {e.kind}
                        </StatusBadge>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {format(e.startsAt, "h:mm a")}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-medium">{e.title}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {view !== "day" && events.length > 0 ? (
        <section>
          <SectionHeader title="Upcoming in range" />
          <div className="space-y-2">
            {events.slice(0, 12).map((e) => (
              <Link
                key={`list-${e.id}`}
                href={e.href}
                className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm shadow-[var(--shadow-card)] hover:border-primary/30"
              >
                <span className="truncate font-medium">{e.title}</span>
                <span className="text-xs text-muted-foreground">
                  {format(e.startsAt, "MMM d · h:mm a")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  )
}
