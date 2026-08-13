import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { requireOrgContext } from "@/server/session"
import {
  getCampaign,
  previewAudienceCount,
  resolveAudienceContacts,
} from "@/domain/campaigns/service"
import { parseCampaignDefinition } from "@/domain/campaigns/definition"
import { buildMergeVars, renderTemplate } from "@/domain/comms/consent"
import {
  approveCampaignAction,
  enrollCampaignAction,
  pauseCampaignAction,
  submitCampaignAction,
  tickCampaignsAction,
} from "@/app/actions"
import {
  EmptyState,
  PageShell,
  SectionHeader,
  StatusBadge,
  Timeline,
} from "@/components/patterns"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function statusTone(
  status: string,
): "default" | "info" | "success" | "warning" | "outline" | "destructive" {
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

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const campaign = await getCampaign(ctx.organization.id, id)
  if (!campaign) notFound()

  const definition = parseCampaignDefinition(campaign.definition)
  const audienceCount = await previewAudienceCount(
    ctx.organization.id,
    campaign.channel,
    campaign.audience,
  )
  const sampleContacts = await resolveAudienceContacts(
    ctx.organization.id,
    campaign.channel,
    campaign.audience,
    1,
  )
  const sample = sampleContacts[0]
  const sendStep = definition.steps.find(
    (s) => s.type === "SEND_EMAIL" || s.type === "SEND_SMS",
  )
  let previewBody = ""
  let previewSubject = ""
  if (sample && sendStep) {
    const email = sample.emails.find((e) => e.isPrimary)?.email ?? sample.emails[0]?.email
    const phone = sample.phones.find((p) => p.isPrimary)?.phone ?? sample.phones[0]?.phone
    const vars = buildMergeVars({
      firstName: sample.firstName,
      lastName: sample.lastName,
      preferredName: sample.preferredName,
      email,
      phone,
      agentName: ctx.user.name,
      organizationName: ctx.organization.name,
    })
    if (sendStep.type === "SEND_EMAIL") {
      previewSubject = renderTemplate(sendStep.subject ?? "Message", vars)
      previewBody = renderTemplate(sendStep.body ?? "", vars)
    } else {
      previewBody = renderTemplate(sendStep.body ?? "", vars)
    }
  }

  const canApprove =
    campaign.status === "PENDING_APPROVAL" && ctx.membership.role !== "ASSISTANT"

  const actionCards: {
    key: string
    title: string
    description: string
    form: ReactNode
  }[] = []

  if (campaign.status === "DRAFT" || campaign.status === "PAUSED") {
    actionCards.push({
      key: "submit",
      title: "Submit for approval",
      description: "Moves the campaign to pending approval. Nothing sends yet.",
      form: (
        <form action={submitCampaignAction}>
          <input type="hidden" name="campaignId" value={campaign.id} />
          <Button type="submit" size="sm">
            Submit for approval
          </Button>
        </form>
      ),
    })
  }
  if (canApprove) {
    actionCards.push({
      key: "approve",
      title: "Approve & activate",
      description: "Approval gate — activates the campaign for enrollment.",
      form: (
        <form action={approveCampaignAction}>
          <input type="hidden" name="campaignId" value={campaign.id} />
          <Button type="submit" size="sm">
            Approve &amp; activate
          </Button>
        </form>
      ),
    })
  }
  if (campaign.status === "ACTIVE") {
    actionCards.push(
      {
        key: "enroll",
        title: "Enroll audience",
        description: "Add matching consenting contacts into the drip.",
        form: (
          <form action={enrollCampaignAction}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <Button type="submit" size="sm">
              Enroll audience
            </Button>
          </form>
        ),
      },
      {
        key: "tick",
        title: "Process due steps",
        description: "Run due delay/send steps now (manual tick).",
        form: (
          <form action={tickCampaignsAction}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <Button type="submit" size="sm" variant="outline">
              Process due steps
            </Button>
          </form>
        ),
      },
      {
        key: "pause",
        title: "Pause",
        description: "Stop processing new steps until re-submitted.",
        form: (
          <form action={pauseCampaignAction}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <Button type="submit" size="sm" variant="outline">
              Pause
            </Button>
          </form>
        ),
      },
    )
  }

  return (
    <PageShell
      title={campaign.name}
      description={campaign.description ?? "Marketing drip campaign"}
      actions={
        <Link
          href="/app/campaigns"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusTone(campaign.status)}>{campaign.status}</StatusBadge>
        <StatusBadge tone="outline">{campaign.channel}</StatusBadge>
        <span className="text-xs text-muted-foreground">
          Audience matching consent: {Math.min(audienceCount, 200)}
          {audienceCount > 200 ? ` (capped at 200 of ${audienceCount})` : ""}
        </span>
        {campaign.approvedAt ? (
          <span className="text-xs text-muted-foreground">
            Approved {format(campaign.approvedAt, "MMM d, yyyy")}
            {campaign.approvedBy ? ` by ${campaign.approvedBy.name}` : ""}
          </span>
        ) : null}
      </div>

      {actionCards.length > 0 ? (
        <section>
          <SectionHeader title="Actions" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actionCards.map((card) => (
              <div
                key={card.key}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div>
                  <p className="text-sm font-medium">{card.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                </div>
                {card.form}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Steps" />
        <Timeline
          items={definition.steps.map((s) => ({
            id: s.key,
            title: s.key,
            meta:
              s.type === "DELAY"
                ? `DELAY · ${s.waitHours}h → ${s.nextKey}`
                : s.type === "SEND_EMAIL" || s.type === "SEND_SMS"
                  ? `${s.type} → ${s.nextKey ?? "end"}`
                  : s.type,
          }))}
        />
        <p className="mt-2 text-xs text-muted-foreground">Entry: {definition.entryKey}</p>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader
          title={
            sample
              ? `Merge preview · ${sample.firstName} ${sample.lastName}`
              : "Merge preview"
          }
        />
        {previewBody ? (
          <div className="space-y-2 text-sm">
            {previewSubject ? (
              <p>
                <span className="text-muted-foreground">Subject:</span> {previewSubject}
              </p>
            ) : null}
            <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">
              {previewBody}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No audience sample available for merge preview (need consenting contacts matching
            filters).
          </p>
        )}
      </section>

      <section>
        <SectionHeader title="Enrollments (recent)" />
        {campaign.enrollments.length === 0 ? (
          <EmptyState
            title="No enrollments yet"
            description="Activate the campaign and enroll the audience to start the drip."
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-[var(--shadow-card)]">
            {campaign.enrollments.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/app/contacts/${e.contact.id}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {e.contact.firstName} {e.contact.lastName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    step {e.currentStepKey ?? "—"}
                    {e.nextRunAt ? ` · next ${format(e.nextRunAt, "MMM d HH:mm")}` : ""}
                    {e.lastError ? ` · ${e.lastError}` : ""}
                  </p>
                </div>
                <StatusBadge tone="outline">{e.status}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}
