import Link from "next/link"
import { requireOrgContext } from "@/server/session"
import { listCampaigns, previewAudienceCount } from "@/domain/campaigns/service"
import { createCampaignAction } from "@/app/actions"
import { PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function CampaignsPage() {
  const ctx = await requireOrgContext()
  const campaigns = await listCampaigns(ctx.organization.id)

  const withCounts = await Promise.all(
    campaigns.map(async (c) => ({
      ...c,
      audienceCount: await previewAudienceCount(
        ctx.organization.id,
        c.channel,
        c.audience,
      ),
    })),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Drip sequences with merge variables. Submit for approval before any external send."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create campaign (draft)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCampaignAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Buyer nurture drip" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Channel</Label>
              <select
                id="channel"
                name="channel"
                defaultValue="EMAIL"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitHours">Initial delay (hours)</Label>
              <Input id="waitHours" name="waitHours" type="number" min={1} defaultValue={24} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactType">Audience contact type</Label>
              <select
                id="contactType"
                name="contactType"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="LEAD">LEAD</option>
                <option value="BUYER">BUYER</option>
                <option value="SELLER">SELLER</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Audience temperature</Label>
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
            <div className="space-y-2">
              <Label htmlFor="lifecycleStage">Lifecycle stage</Label>
              <select
                id="lifecycleStage"
                name="lifecycleStage"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="NEW">NEW</option>
                <option value="NURTURE">NURTURE</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceContains">Source contains</Label>
              <Input id="sourceContains" name="sourceContains" placeholder="zillow" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagName">Tag name</Label>
              <Input id="tagName" name="tagName" placeholder="Optional tag" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sendSubject">Email subject (ignored for SMS)</Label>
              <Input
                id="sendSubject"
                name="sendSubject"
                placeholder="Hello {{firstName}}"
                defaultValue="Hello {{firstName}}"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sendBody">Message body</Label>
              <textarea
                id="sendBody"
                name="sendBody"
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue="Hi {{firstName}}, checking in from {{organizationName}}. — {{agentName}}"
              />
              <p className="text-xs text-muted-foreground">
                Merge vars: {"{{firstName}}"}, {"{{lastName}}"}, {"{{preferredName}}"},{" "}
                {"{{agentName}}"}, {"{{email}}"}, {"{{phone}}"}, {"{{organizationName}}"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create draft</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All campaigns</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {withCounts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            withCounts.map((c) => (
              <Link
                key={c.id}
                href={`/app/campaigns/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.channel} · audience ~{Math.min(c.audienceCount, 200)} · enrollments{" "}
                    {c._count.enrollments}
                  </p>
                </div>
                <Badge variant="outline">{c.status}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
