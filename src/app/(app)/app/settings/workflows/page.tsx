import { requireOrgContext } from "@/server/session"
import {
  listEnrollments,
  listWorkflows,
  tickWorkflowsForOrg,
} from "@/domain/workflows/service"
import { parseWorkflowDefinition } from "@/domain/workflows/definition"
import { PageHeader } from "@/components/crm/shared"
import {
  createWorkflowAction,
  deleteWorkflowAction,
  setWorkflowStatusAction,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default async function WorkflowsSettingsPage() {
  const ctx = await requireOrgContext()
  await tickWorkflowsForOrg(ctx.organization.id)

  const [workflows, enrollments] = await Promise.all([
    listWorkflows(ctx.organization.id),
    listEnrollments(ctx.organization.id, { take: 30 }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Triggers enroll leads into step sequences: conditions, tasks, delays, branches."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createWorkflowAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="New lead nurture" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger">Trigger</Label>
              <select
                id="trigger"
                name="trigger"
                defaultValue="OPPORTUNITY_CREATED"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="OPPORTUNITY_CREATED">Opportunity created</option>
                <option value="STAGE_CHANGED">Stage changed</option>
                <option value="TASK_COMPLETED">Task completed</option>
                <option value="MANUAL">Manual enroll</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Initial status</Label>
              <select
                id="status"
                name="status"
                defaultValue="DRAFT"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filterType">Filter type</Label>
              <select
                id="filterType"
                name="filterType"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="BUYER">BUYER</option>
                <option value="SELLER">SELLER</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterTemperature">Filter temperature</Label>
              <select
                id="filterTemperature"
                name="filterTemperature"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="COLD">COLD</option>
                <option value="WARM">WARM</option>
                <option value="HOT">HOT</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterStageKey">Filter stage key</Label>
              <Input id="filterStageKey" name="filterStageKey" placeholder="e.g. NEW" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterSourceContains">Filter source contains</Label>
              <Input id="filterSourceContains" name="filterSourceContains" placeholder="zillow" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium">Steps (guided)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchTemperature">Branch: only continue if temperature</Label>
              <select
                id="branchTemperature"
                name="branchTemperature"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">No branch</option>
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COLD">COLD</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Create task title</Label>
              <Input id="taskTitle" name="taskTitle" defaultValue="Workflow follow-up" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskPriority">Task priority</Label>
              <select
                id="taskPriority"
                name="taskPriority"
                defaultValue="MEDIUM"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueInHours">Task due in hours</Label>
              <Input id="dueInHours" name="dueInHours" type="number" placeholder="24" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="noteBody">Optional note body</Label>
              <Input id="noteBody" name="noteBody" placeholder="Internal note from workflow" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moveStageKey">Optional move to stage key</Label>
              <Input id="moveStageKey" name="moveStageKey" placeholder="CONTACTED" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitHours">Optional delay hours (before exit)</Label>
              <Input id="waitHours" name="waitHours" type="number" placeholder="0" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create workflow</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workflows yet.</p>
          ) : (
            workflows.map((w) => {
              let trigger = "?"
              try {
                trigger = parseWorkflowDefinition(w.definition).trigger
              } catch {
                trigger = "invalid"
              }
              return (
                <div key={w.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {trigger} · {w._count.enrollments} enrollments
                      </p>
                    </div>
                    <Badge variant="outline">{w.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.status !== "ACTIVE" ? (
                      <form action={setWorkflowStatusAction}>
                        <input type="hidden" name="workflowId" value={w.id} />
                        <input type="hidden" name="status" value="ACTIVE" />
                        <Button type="submit" size="sm" variant="outline">
                          Activate
                        </Button>
                      </form>
                    ) : (
                      <form action={setWorkflowStatusAction}>
                        <input type="hidden" name="workflowId" value={w.id} />
                        <input type="hidden" name="status" value="PAUSED" />
                        <Button type="submit" size="sm" variant="outline">
                          Pause
                        </Button>
                      </form>
                    )}
                    <form action={setWorkflowStatusAction}>
                      <input type="hidden" name="workflowId" value={w.id} />
                      <input type="hidden" name="status" value="ARCHIVED" />
                      <Button type="submit" size="sm" variant="ghost">
                        Archive
                      </Button>
                    </form>
                    <form action={deleteWorkflowAction}>
                      <input type="hidden" name="workflowId" value={w.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent enrollments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {enrollments.length === 0 ? (
            <p className="text-muted-foreground">No enrollments yet.</p>
          ) : (
            enrollments.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                <div>
                  <p className="font-medium">{e.workflow.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.opportunity?.title ??
                      (e.contact
                        ? `${e.contact.firstName} ${e.contact.lastName}`
                        : "—")}
                    {" · "}
                    step {e.currentStepKey ?? "—"}
                    {e.nextRunAt ? ` · next ${format(e.nextRunAt, "MMM d h:mm a")}` : ""}
                    {e.lastError ? ` · err: ${e.lastError}` : ""}
                  </p>
                </div>
                <Badge variant="secondary">{e.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
