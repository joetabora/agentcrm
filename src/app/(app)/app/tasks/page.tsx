import Link from "next/link"
import { format } from "date-fns"
import { completeTaskAction, createAppointmentAction, createTaskAction } from "@/app/actions"
import { listAppointments, listTasks } from "@/domain/tasks/service"
import { listContacts } from "@/domain/contacts/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const [tasks, appointments, contacts] = await Promise.all([
    listTasks(ctx.organization.id, { status: "OPEN" }),
    listAppointments(ctx.organization.id),
    listContacts(ctx.organization.id),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks & appointments" description="Daily agenda building blocks" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.length === 0 ? (
              <EmptyState title="No open tasks" description="Create a follow-up below." />
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{t.priority}</Badge>
                      {t.dueAt ? <span>Due {format(t.dueAt, "MMM d, h:mm a")}</span> : null}
                      {t.contact ? (
                        <Link href={`/app/contacts/${t.contact.id}`} className="hover:underline">
                          {t.contact.firstName} {t.contact.lastName}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <form action={completeTaskAction}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Done
                    </Button>
                  </form>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.length === 0 ? (
              <EmptyState title="No appointments" description="Schedule one below." />
            ) : (
              appointments.map((a) => (
                <div key={a.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-muted-foreground">
                    {format(a.startsAt, "MMM d, yyyy h:mm a")}
                    {a.contact
                      ? ` · ${a.contact.firstName} ${a.contact.lastName}`
                      : ""}
                  </p>
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
