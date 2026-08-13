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
import { PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={campaign.description ?? "Marketing drip campaign"}
        actions={
          <Link
            href="/app/campaigns"
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
          >
            Back
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{campaign.status}</Badge>
        <Badge variant="outline">{campaign.channel}</Badge>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {campaign.status === "DRAFT" || campaign.status === "PAUSED" ? (
            <form action={submitCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button type="submit">Submit for approval</Button>
            </form>
          ) : null}
          {canApprove ? (
            <form action={approveCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button type="submit">Approve &amp; activate</Button>
            </form>
          ) : null}
          {campaign.status === "ACTIVE" ? (
            <>
              <form action={enrollCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit">Enroll audience</Button>
              </form>
              <form action={tickCampaignsAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" variant="outline">
                  Process due steps now
                </Button>
              </form>
              <form action={pauseCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" variant="outline">
                  Pause
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {definition.steps.map((s) => (
              <li key={s.key}>
                <span className="font-medium">{s.key}</span> · {s.type}
                {s.type === "DELAY" ? ` (${s.waitHours}h → ${s.nextKey})` : null}
                {s.type === "SEND_EMAIL" || s.type === "SEND_SMS"
                  ? ` → ${s.nextKey ?? "end"}`
                  : null}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">Entry: {definition.entryKey}</p>
        </CardContent>
      </Card>

      {previewBody ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Merge preview
              {sample ? ` · ${sample.firstName} ${sample.lastName}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {previewSubject ? (
              <p>
                <span className="text-muted-foreground">Subject:</span> {previewSubject}
              </p>
            ) : null}
            <pre className="whitespace-pre-wrap rounded bg-muted/50 p-3 text-xs">{previewBody}</pre>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            No audience sample available for merge preview (need consenting contacts matching
            filters).
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollments (recent)</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {campaign.enrollments.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No enrollments yet.</p>
          ) : (
            campaign.enrollments.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
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
                <Badge variant="outline">{e.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
