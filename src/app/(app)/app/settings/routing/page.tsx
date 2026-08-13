import { requireOrgContext } from "@/server/session"
import { listRoutingRules } from "@/domain/routing/service"
import { listOrgMembers } from "@/domain/orgs/members"
import { PageHeader } from "@/components/crm/shared"
import { createRoutingRuleAction, deleteRoutingRuleAction, toggleRoutingRuleAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default async function RoutingSettingsPage() {
  const ctx = await requireOrgContext()
  const [rules, members] = await Promise.all([
    listRoutingRules(ctx.organization.id),
    listOrgMembers(ctx.organization.id),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead routing rules"
        description="First matching enabled rule assigns the new opportunity. Order matters."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRoutingRuleAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Zillow buyers → round robin" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Priority (lower = first)</Label>
              <Input id="position" name="position" type="number" defaultValue={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignMode">Assign mode</Label>
              <select
                id="assignMode"
                name="assignMode"
                defaultValue="SPECIFIC_USER"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="SPECIFIC_USER">Specific user</option>
                <option value="ROUND_ROBIN">Round robin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetUserId">Target user (specific mode)</Label>
              <select
                id="targetUserId"
                name="targetUserId"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Match type</Label>
              <select
                id="type"
                name="type"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="BUYER">BUYER</option>
                <option value="SELLER">SELLER</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Match temperature</Label>
              <select
                id="temperature"
                name="temperature"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="COLD">COLD</option>
                <option value="WARM">WARM</option>
                <option value="HOT">HOT</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sourceContains">Source contains</Label>
              <Input id="sourceContains" name="sourceContains" placeholder="Zillow" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minEstimatedValue">Min estimated value</Label>
              <Input id="minEstimatedValue" name="minEstimatedValue" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxEstimatedValue">Max estimated value</Label>
              <Input id="maxEstimatedValue" name="maxEstimatedValue" type="number" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create rule</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules yet — creators keep new leads.</p>
        ) : (
          rules.map((rule) => {
            const conditions = (rule.conditions ?? {}) as Record<string, unknown>
            return (
              <Card key={rule.id}>
                <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      <Badge variant={rule.enabled ? "default" : "secondary"}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline">#{rule.position}</Badge>
                      <Badge variant="outline">{rule.assignMode}</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {rule.assignMode === "SPECIFIC_USER"
                        ? `→ ${rule.targetUser?.name ?? "missing user"}`
                        : `Round-robin (index ${rule.roundRobinIndex})`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Conditions: {JSON.stringify(conditions)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleRoutingRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input type="hidden" name="enabled" value={rule.enabled ? "0" : "1"} />
                      <Button type="submit" size="sm" variant="outline">
                        {rule.enabled ? "Disable" : "Enable"}
                      </Button>
                    </form>
                    <form action={deleteRoutingRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <Button type="submit" size="sm" variant="destructive">
                        Delete
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
