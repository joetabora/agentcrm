import Link from "next/link"
import { format, endOfDay, startOfDay, addDays } from "date-fns"
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  createAppointmentAction,
  createTaskAction,
  rescheduleAppointmentAction,
} from "@/app/actions"
import { listAppointments, listTasks, type TaskListFilter } from "@/domain/tasks/service"
import { listContacts } from "@/domain/contacts/service"
import { requireOrgContext } from "@/server/session"
import {
  EmptyState,
  NativeSelect,
  PageShell,
  SectionHeader,
  StatusBadge,
} from "@/components/patterns"
import { TaskActionBar } from "@/components/crm/task-action-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const FILTER_PILLS: {
  key: "today" | "upcoming" | "overdue" | "completed"
  label: string
}[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
]

function resolveTaskQuery(filterKey: string): {
  filter: TaskListFilter
  dueBefore?: Date
  dueAfter?: Date
} {
  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)

  switch (filterKey) {
    case "upcoming":
      return { filter: "open", dueAfter: dayEnd }
    case "overdue":
      return { filter: "overdue" }
    case "completed":
      return { filter: "completed" }
    case "today":
    default:
      return { filter: "open", dueAfter: dayStart, dueBefore: dayEnd }
  }
}

function priorityTone(
  priority: string,
): "default" | "info" | "warning" | "destructive" {
  if (priority === "URGENT") return "destructive"
  if (priority === "HIGH") return "warning"
  if (priority === "LOW") return "default"
  return "info"
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; filter?: string; day?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const filterParam = FILTER_PILLS.some((f) => f.key === params.filter)
    ? (params.filter as (typeof FILTER_PILLS)[number]["key"])
    : "today"

  const taskQuery = resolveTaskQuery(filterParam)
  const dayStart = startOfDay(new Date())
  const dayEnd = endOfDay(addDays(dayStart, params.day === "week" ? 7 : 0))

  const [tasks, appointments, contacts] = await Promise.all([
    listTasks(ctx.organization.id, {
      filter: taskQuery.filter,
      dueBefore: taskQuery.dueBefore,
      dueAfter: taskQuery.dueAfter,
    }),
    listAppointments(ctx.organization.id, { from: dayStart, to: dayEnd }),
    listContacts(ctx.organization.id),
  ])

  const redirectTo =
    filterParam === "today" ? "/app/tasks" : `/app/tasks?filter=${filterParam}`
  const weekHref =
    filterParam === "today"
      ? "/app/tasks?day=week"
      : `/app/tasks?filter=${filterParam}&day=week`

  return (
    <PageShell
      title="Tasks"
      description="Follow-ups, snoozes, and appointments — dense list, quick actions."
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTER_PILLS.map((f) => {
          const href = f.key === "today" ? "/app/tasks" : `/app/tasks?filter=${f.key}`
          const active = filterParam === f.key
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <section>
        <SectionHeader title={`Tasks · ${tasks.length}`} />
        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks in this view"
            description="Create a follow-up below, or switch filters."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-[var(--shadow-card)]">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <StatusBadge tone={priorityTone(t.priority)}>{t.priority}</StatusBadge>
                    {t.recurrenceRule !== "NONE" ? (
                      <StatusBadge tone="outline">{t.recurrenceRule}</StatusBadge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {t.dueAt ? <span>Due {format(t.dueAt, "MMM d, h:mm a")}</span> : null}
                    {t.snoozedUntil ? (
                      <span>Until {format(t.snoozedUntil, "MMM d, h:mm a")}</span>
                    ) : null}
                    {t.contact ? (
                      <Link
                        href={`/app/contacts/${t.contact.id}`}
                        className="text-primary hover:underline"
                      >
                        {t.contact.firstName} {t.contact.lastName}
                      </Link>
                    ) : null}
                  </div>
                </div>
                {t.status === "OPEN" || t.status === "SNOOZED" ? (
                  <TaskActionBar
                    taskId={t.id}
                    redirectTo={redirectTo}
                    compact
                  />
                ) : (
                  <StatusBadge tone="success">{t.status}</StatusBadge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="opacity-95">
        <SectionHeader
          title={`Appointments · ${params.day === "week" ? "next 7 days" : "today"}`}
          action={
            <Link
              href={params.day === "week" ? redirectTo : weekHref}
              className="text-xs text-muted-foreground hover:underline"
            >
              {params.day === "week" ? "Show today" : "Show week"}
            </Link>
          }
        />
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments in this window.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card/80">
            {appointments.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(a.startsAt, "MMM d, yyyy h:mm a")}
                    {a.contact ? ` · ${a.contact.firstName} ${a.contact.lastName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <form action={completeAppointmentAction}>
                    <input type="hidden" name="appointmentId" value={a.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Done
                    </Button>
                  </form>
                  <form action={cancelAppointmentAction}>
                    <input type="hidden" name="appointmentId" value={a.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Cancel
                    </Button>
                  </form>
                  <form action={rescheduleAppointmentAction} className="flex items-center gap-1">
                    <input type="hidden" name="appointmentId" value={a.id} />
                    <Input
                      name="startsAt"
                      type="datetime-local"
                      required
                      className="h-7 w-auto"
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      Reschedule
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <SectionHeader title="Create task" />
          <form action={createTaskAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueAt">Due</Label>
              <Input id="dueAt" name="dueAt" type="datetime-local" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <NativeSelect id="priority" name="priority" defaultValue="MEDIUM">
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurrenceRule">Repeat</Label>
              <NativeSelect id="recurrenceRule" name="recurrenceRule" defaultValue="NONE">
                <option value="NONE">Does not repeat</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactId">Contact</Label>
              <NativeSelect
                id="contactId"
                name="contactId"
                defaultValue={params.contactId ?? ""}
              >
                <option value="">None</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit">Create task</Button>
          </form>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <SectionHeader title="Schedule appointment" />
          <form action={createAppointmentAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-title">Title</Label>
              <Input id="appt-title" name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-contactId">Contact</Label>
              <NativeSelect id="appt-contactId" name="contactId" defaultValue="">
                <option value="">None</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" />
            </div>
            <Button type="submit">Schedule</Button>
          </form>
        </div>
      </div>
    </PageShell>
  )
}
