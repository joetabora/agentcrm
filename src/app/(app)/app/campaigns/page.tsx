import Link from "next/link"
import { requireOrgContext } from "@/server/session"
import { listCampaigns, previewAudienceCount } from "@/domain/campaigns/service"
import { createCampaignAction } from "@/app/actions"
import {
  EmptyState,
  NativeSelect,
  NativeTextarea,
  PageShell,
  SectionHeader,
  StatusBadge,
} from "@/components/patterns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function statusTone(
  status: string,
): "default" | "info" | "success" | "warning" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "success"
    case "PENDING_APPROVAL":
      return "warning"
    case "DRAFT":
      return "outline"
    case "PAUSED":
      return "info"
    default:
      return "default"
  }
}

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
    <PageShell
      title="Marketing"
      description="Drip sequences with merge variables. Submit for approval before any external send."
    >
      <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Create campaign" />
        <form action={createCampaignAction} className="space-y-8">
          {/* Step 1 — Audience */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                1
              </span>
              <h3 className="text-sm font-medium">Audience</h3>
            </div>
            <div className="grid gap-3 border-l-2 border-primary/20 pl-5 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="Buyer nurture drip" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="channel">Channel</Label>
                <NativeSelect id="channel" name="channel" defaultValue="EMAIL">
                  <option value="EMAIL">EMAIL</option>
                  <option value="SMS">SMS</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactType">Contact type</Label>
                <NativeSelect id="contactType" name="contactType" defaultValue="">
                  <option value="">Any</option>
                  <option value="LEAD">LEAD</option>
                  <option value="BUYER">BUYER</option>
                  <option value="SELLER">SELLER</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="temperature">Temperature</Label>
                <NativeSelect id="temperature" name="temperature" defaultValue="">
                  <option value="">Any</option>
                  <option value="COLD">COLD</option>
                  <option value="WARM">WARM</option>
                  <option value="HOT">HOT</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lifecycleStage">Lifecycle stage</Label>
                <NativeSelect id="lifecycleStage" name="lifecycleStage" defaultValue="">
                  <option value="">Any</option>
                  <option value="NEW">NEW</option>
                  <option value="NURTURE">NURTURE</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sourceContains">Source contains</Label>
                <Input id="sourceContains" name="sourceContains" placeholder="zillow" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tagName">Tag name</Label>
                <Input id="tagName" name="tagName" placeholder="Optional tag" />
              </div>
            </div>
          </section>

          {/* Step 2 — Draft */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                2
              </span>
              <h3 className="text-sm font-medium">Draft</h3>
            </div>
            <div className="grid gap-3 border-l-2 border-primary/20 pl-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="waitHours">Initial delay (hours)</Label>
                <Input id="waitHours" name="waitHours" type="number" min={1} defaultValue={24} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sendSubject">Email subject (ignored for SMS)</Label>
                <Input
                  id="sendSubject"
                  name="sendSubject"
                  placeholder="Hello {{firstName}}"
                  defaultValue="Hello {{firstName}}"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sendBody">Message body</Label>
                <NativeTextarea
                  id="sendBody"
                  name="sendBody"
                  rows={4}
                  defaultValue="Hi {{firstName}}, checking in from {{organizationName}}. — {{agentName}}"
                />
                <p className="text-xs text-muted-foreground">
                  Merge vars: {"{{firstName}}"}, {"{{lastName}}"}, {"{{preferredName}}"},{" "}
                  {"{{agentName}}"}, {"{{email}}"}, {"{{phone}}"}, {"{{organizationName}}"}
                </p>
              </div>
            </div>
          </section>

          {/* Step 3 — Review */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                3
              </span>
              <h3 className="text-sm font-medium">Review</h3>
            </div>
            <div className="space-y-3 border-l-2 border-primary/20 pl-5">
              <p className="text-sm text-muted-foreground">
                Creates a <strong className="font-medium text-foreground">draft</strong> only.
                Nothing sends until you submit for approval and an eligible role activates the
                campaign.
              </p>
              <Button type="submit">Create draft</Button>
            </div>
          </section>
        </form>
      </div>

      <section>
        <SectionHeader title="All campaigns" />
        {withCounts.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Create a draft above to start a drip sequence."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-[var(--shadow-card)]">
            {withCounts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/campaigns/${c.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.channel} · audience ~{Math.min(c.audienceCount, 200)} · enrollments{" "}
                      {c._count.enrollments}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(c.status)}>{c.status}</StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}
