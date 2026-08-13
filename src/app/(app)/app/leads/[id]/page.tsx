import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  moveStageAction,
  reassignOpportunityAction,
  setTemperatureAction,
} from "@/app/actions"
import { getOpportunity } from "@/domain/opportunities/service"
import { listOrgMembers } from "@/domain/orgs/members"
import { requireOrgContext } from "@/server/session"
import { TemperatureBadge } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const [opportunity, members] = await Promise.all([
    getOpportunity(ctx.organization.id, id),
    listOrgMembers(ctx.organization.id),
  ])
  if (!opportunity) notFound()

  const stages = opportunity.pipeline.stages

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
            <Badge variant="secondary">{opportunity.type}</Badge>
            <TemperatureBadge value={opportunity.temperature} />
          </div>
          <p className="text-sm text-muted-foreground">
            {opportunity.pipelineStage.name}
            {opportunity.source ? ` · ${opportunity.source}` : ""}
          </p>
          <p className="mt-1 text-sm">
            Contact:{" "}
            <Link href={`/app/contacts/${opportunity.contactId}`} className="hover:underline">
              {opportunity.contact.firstName} {opportunity.contact.lastName}
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            Assignee: {opportunity.assignedTo?.name ?? "Unassigned"}
          </p>
        </div>
        <Link href="/app/leads" className="text-sm text-muted-foreground hover:underline">
          ← Back to leads
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={moveStageAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <input type="hidden" name="redirectTo" value={`/app/leads/${opportunity.id}`} />
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Stage</span>
                <select
                  name="pipelineStageId"
                  defaultValue={opportunity.pipelineStageId}
                  className="block h-8 rounded-md border bg-background px-2"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm">
                Move stage
              </Button>
            </form>

            <form action={setTemperatureAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Temperature</span>
                <select
                  name="temperature"
                  defaultValue={opportunity.temperature}
                  className="block h-8 rounded-md border bg-background px-2"
                >
                  <option value="COLD">COLD</option>
                  <option value="WARM">WARM</option>
                  <option value="HOT">HOT</option>
                </select>
              </label>
              <Button type="submit" size="sm" variant="outline">
                Set temp
              </Button>
            </form>

            <form action={reassignOpportunityAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <input type="hidden" name="redirectTo" value={`/app/leads/${opportunity.id}`} />
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Reassign to</span>
                <select
                  name="toUserId"
                  defaultValue={opportunity.assignedToUserId ?? ""}
                  className="block h-8 rounded-md border bg-background px-2"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                name="reason"
                placeholder="Reason"
                className="h-8 rounded-md border bg-background px-2 text-sm"
              />
              <Button type="submit" size="sm" variant="outline">
                Reassign
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {opportunity.assignmentEvents.length === 0 ? (
              <p className="text-muted-foreground">No assignment events yet.</p>
            ) : (
              opportunity.assignmentEvents.map((e) => (
                <div key={e.id} className="border-l-2 pl-3">
                  <p className="font-medium">
                    {e.fromUser?.name ?? "Unassigned"} → {e.toUser?.name ?? "Unassigned"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(e.createdAt, "MMM d, yyyy h:mm a")} · {e.source}
                    {e.actor ? ` · by ${e.actor.name}` : ""}
                  </p>
                  {e.reason ? <p className="text-muted-foreground">{e.reason}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
