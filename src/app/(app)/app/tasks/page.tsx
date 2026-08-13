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
import { EmptyState, PageHeader } from "@/components/crm/shared"
import { TaskActionBar } from "@/components/crm/task-action-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const FILTERS: { key: TaskListFilter | "me"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "snoozed", label: "Snoozed" },
  { key: "me", label: "Assigned to me" },
  { key: "completed", label: "Completed" },
]

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; filter?: string; day?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const filterParam = params.filter ?? "open"
  const isMe = filterParam === "me"
  const filter: TaskListFilter = isMe
    ? "open"
    : FILTERS.some((f) => f.key === filterParam)
      ? (filterParam as TaskListFilter)
      : "open"

  const dayStart = startOfDay(new Date())
  const dayEnd = endOfDay(addDays(dayStart, params.day === "week" ? 7 : 0))

  const [tasks, appointments, contacts] = await Promise.all([
    listTasks(ctx.organization.id, {
      filter,
      assigneeUserId: isMe ? ctx.user.id : undefined,
    }),
    listAppointments(ctx.organization.id, { from: dayStart, to: dayEnd }),
    listContacts(ctx.organization.id),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks & appointments"
        description="Snooze, reschedule, and recurring follow-ups"
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const href = f.key === "open" ? "/app/tasks" : `/app/tasks?filter=${f.key}`
          const active = filterParam === f.key || (f.key === "open" && !params.filter)
          return (
            <Link
              key={f.key}
              href={href}
              className={`rounded-full border px-3 py-1 text-sm ${active ? "bg-primary text-primary-foreground" : ""}`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.length === 0 ? (
              <EmptyState title="No tasks in this view" description="Create a follow-up below." />
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="space-y-2 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{t.priority}</Badge>
                      <Badge variant="outline">{t.status}</Badge>
                      {t.recurrenceRule !== "NONE" ? (
                        <Badge variant="secondary">{t.recurrenceRule}</Badge>
                      ) : null}
                      {t.dueAt ? <span>Due {format(t.dueAt, "MMM d, h:mm a")}</span> : null}
                      {t.snoozedUntil ? (
                        <span>Until {format(t.snoozedUntil, "MMM d, h:mm a")}</span>
                      ) : null}
                      {t.contact ? (
                        <Link href={`/app/contacts/${t.contact.id}`} className="hover:underline">
                          {t.contact.firstName} {t.contact.lastName}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {t.status === "OPEN" || t.status === "SNOOZED" ? (
                    <TaskActionBar taskId={t.id} redirectTo={`/app/tasks?filter=${filterParam}`} />
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Appointments ({params.day === "week" ? "next 7 days" : "today"})
            </CardTitle>
            <Link
              href={params.day === "week" ? "/app/tasks" : "/app/tasks?day=week"}
              className="text-xs text-muted-foreground hover:underline"
            >
              {params.day === "week" ? "Show today" : "Show week"}
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.length === 0 ? (
              <EmptyState title="No appointments" description="Schedule one below." />
            ) : (
              appointments.map((a) => (
                <div key={a.id} className="space-y-2 rounded-md border p-3 text-sm">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-muted-foreground">
                    {format(a.startsAt, "MMM d, yyyy h:mm a")}
                    {a.contact ? ` · ${a.contact.firstName} ${a.contact.lastName}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
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
                        className="h-8 w-auto"
                      />
                      <Button type="submit" size="sm" variant="ghost">
                        Reschedule
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create task</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTaskAction} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueAt">Due</Label>
                <Input id="dueAt" name="dueAt" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="MEDIUM"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrenceRule">Repeat</Label>
                <select
                  id="recurrenceRule"
                  name="recurrenceRule"
                  defaultValue="NONE"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="NONE">Does not repeat</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactId">Contact</Label>
                <select
                  id="contactId"
                  name="contactId"
                  defaultValue={params.contactId ?? ""}
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="">None</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">Create task</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAppointmentAction} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="appt-title">Title</Label>
                <Input id="appt-title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startsAt">Starts</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-contactId">Contact</Label>
                <select
                  id="appt-contactId"
                  name="contactId"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="">None</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" />
              </div>
              <Button type="submit">Schedule</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
