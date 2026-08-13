import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  addNoteAction,
  enrollWorkflowAction,
  saveBuyerInterestAction,
  sendEmailAction,
  sendSmsAction,
  updateBuyerPreferencesAction,
  updateConsentAction,
} from "@/app/actions"
import { getContact } from "@/domain/contacts/service"
import { listTemplates, listThreadsForContact } from "@/domain/comms/service"
import { matchPropertiesForContact } from "@/domain/properties/service"
import { safeParseBuyerPreferences } from "@/domain/properties/preferences"
import { listActiveWorkflowsForManual } from "@/domain/workflows/service"
import { getEmailProvider } from "@/providers/email"
import { getSmsProvider } from "@/providers/sms"
import { requireOrgContext } from "@/server/session"
import { EmptyState, TemperatureBadge } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const sp = await searchParams
  const [contact, manualWorkflows, templates, threads, propertyMatches] = await Promise.all([
    getContact(ctx.organization.id, id),
    listActiveWorkflowsForManual(ctx.organization.id),
    listTemplates(ctx.organization.id),
    listThreadsForContact(ctx.organization.id, id).catch(() => []),
    matchPropertiesForContact(ctx.organization.id, id).catch(() => []),
  ])
  if (!contact) notFound()

  const prefsParsed = safeParseBuyerPreferences(contact.preferences)
  const prefs = prefsParsed.success ? prefsParsed.data : {}

  const emailProvider = getEmailProvider().name
  const smsProvider = getSmsProvider().name
  const emailTemplates = templates.filter((t) => t.channel === "EMAIL")
  const smsTemplates = templates.filter((t) => t.channel === "SMS")

  const email = contact.emails.find((e) => e.isPrimary)?.email ?? contact.emails[0]?.email
  const phone = contact.phones.find((p) => p.isPrimary)?.phone ?? contact.phones[0]?.phone

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contact.firstName} {contact.lastName}
            </h1>
            <Badge variant="secondary">{contact.contactType}</Badge>
            <TemperatureBadge value={contact.temperature} />
          </div>
          <p className="text-sm text-muted-foreground">
            {contact.lifecycleStage}
            {contact.source ? ` · Source: ${contact.source}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {email ? <a href={`mailto:${email}`} className="hover:underline">{email}</a> : null}
            {phone ? <a href={`tel:${phone}`} className="hover:underline">{phone}</a> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/leads/new?contactId=${contact.id}`}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
          >
            Create opportunity
          </Link>
          <Link
            href={`/app/tasks?contactId=${contact.id}`}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
          >
            Add task
          </Link>
          {manualWorkflows.length > 0 ? (
            <form action={enrollWorkflowAction} className="inline-flex h-8 items-center gap-1">
              <input type="hidden" name="contactId" value={contact.id} />
              <input type="hidden" name="redirectTo" value={`/app/contacts/${contact.id}`} />
              <select
                name="workflowId"
                required
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                {manualWorkflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline">
                Enroll
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {sp.error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {sp.error}
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send message</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <form action={sendEmailAction} className="space-y-2 rounded-lg border p-3">
                <input type="hidden" name="contactId" value={contact.id} />
                <p className="text-xs text-muted-foreground">
                  Email via <strong>{emailProvider}</strong>
                  {!contact.consentEmail || contact.doNotContact
                    ? " · blocked until consent/DNC allows"
                    : ""}
                </p>
                <select
                  name="templateId"
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                  defaultValue=""
                >
                  <option value="">No template</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Input name="subject" placeholder="Subject" defaultValue="" />
                <textarea
                  name="body"
                  rows={4}
                  placeholder="Hi {{firstName}}…"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm" disabled={!email}>
                  Send email
                </Button>
              </form>

              <form action={sendSmsAction} className="space-y-2 rounded-lg border p-3">
                <input type="hidden" name="contactId" value={contact.id} />
                <p className="text-xs text-muted-foreground">
                  SMS via <strong>{smsProvider}</strong>
                  {!contact.consentSms || contact.doNotContact
                    ? " · blocked until consent/DNC allows"
                    : ""}
                </p>
                <select
                  name="templateId"
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                  defaultValue=""
                >
                  <option value="">No template</option>
                  {smsTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <textarea
                  name="body"
                  rows={4}
                  placeholder="Hi {{firstName}}, …"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm" disabled={!phone}>
                  Send SMS
                </Button>
              </form>
            </CardContent>
          </Card>

          {threads.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Message threads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {threads.map((th) => (
                  <div key={th.id} className="rounded-md border p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {th.channel}
                      {th.subject ? ` · ${th.subject}` : ""}
                    </p>
                    <ul className="space-y-2">
                      {th.messages.map((m) => (
                        <li key={m.id} className="text-sm">
                          <span className="text-xs text-muted-foreground">
                            {m.direction} · {m.status} · {format(m.createdAt, "MMM d h:mm a")}
                            {m.providerName ? ` · ${m.providerName}` : ""}
                          </span>
                          {m.subject ? <p className="font-medium">{m.subject}</p> : null}
                          <p className="whitespace-pre-wrap text-muted-foreground">{m.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buyer preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Fair Housing allowlist only: budget, beds, baths, type, city, ZIP, max DOM.
              </p>
              <form action={updateBuyerPreferencesAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="contactId" value={contact.id} />
                <div className="space-y-1">
                  <Label htmlFor="budgetMin">Budget min</Label>
                  <Input
                    id="budgetMin"
                    name="budgetMin"
                    type="number"
                    defaultValue={contact.budgetMin != null ? Number(contact.budgetMin) : ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="budgetMax">Budget max</Label>
                  <Input
                    id="budgetMax"
                    name="budgetMax"
                    type="number"
                    defaultValue={contact.budgetMax != null ? Number(contact.budgetMax) : ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bedsMin">Beds min</Label>
                  <Input
                    id="bedsMin"
                    name="bedsMin"
                    type="number"
                    step="0.5"
                    defaultValue={prefs.bedsMin ?? ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bathsMin">Baths min</Label>
                  <Input
                    id="bathsMin"
                    name="bathsMin"
                    type="number"
                    step="0.5"
                    defaultValue={prefs.bathsMin ?? ""}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cities">Cities (comma-separated)</Label>
                  <Input
                    id="cities"
                    name="cities"
                    defaultValue={prefs.cities?.join(", ") ?? ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zips">ZIPs</Label>
                  <Input id="zips" name="zips" defaultValue={prefs.zips?.join(", ") ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="propertyTypes">Property types</Label>
                  <Input
                    id="propertyTypes"
                    name="propertyTypes"
                    defaultValue={prefs.propertyTypes?.join(", ") ?? ""}
                    placeholder="Single Family, Condo"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maxDom">Max days on market</Label>
                  <Input
                    id="maxDom"
                    name="maxDom"
                    type="number"
                    defaultValue={prefs.maxDom ?? ""}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm">
                    Save preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matching properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {propertyMatches.length === 0 ? (
                <p className="text-muted-foreground">
                  No matches yet. Save preferences above; scores use org inventory only.
                </p>
              ) : (
                propertyMatches.map((m) => (
                  <div key={m.property.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/app/properties/${m.property.id}`}
                        className="font-medium hover:underline"
                      >
                        {m.property.line1}, {m.property.city}
                      </Link>
                      <Badge variant="secondary">score {m.score}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
                    <form action={saveBuyerInterestAction} className="mt-2">
                      <input type="hidden" name="contactId" value={contact.id} />
                      <input type="hidden" name="propertyId" value={m.property.id} />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/app/contacts/${contact.id}`}
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Save interest
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={addNoteAction} className="space-y-2 rounded-lg border p-3">
                <input type="hidden" name="contactId" value={contact.id} />
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Add a note…"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm">
                  Save note
                </Button>
              </form>

              {contact.activities.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Notes, stage changes, and tasks will appear here chronologically."
                />
              ) : (
                <ul className="space-y-3">
                  {contact.activities.map((a) => (
                    <li key={a.id} className="border-l-2 pl-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{a.type}</Badge>
                        <span>{format(a.occurredAt, "MMM d, yyyy h:mm a")}</span>
                        {a.actor ? <span>· {a.actor.name}</span> : null}
                      </div>
                      {a.subject ? <p className="mt-1 text-sm font-medium">{a.subject}</p> : null}
                      {a.body ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                          {a.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Who is this?</p>
                <p className="text-muted-foreground">
                  {contact.preferredName || contact.firstName} {contact.lastName} ·{" "}
                  {contact.contactType.replaceAll("_", " ").toLowerCase()}
                </p>
              </div>
              <div>
                <p className="font-medium">What do they want?</p>
                <p className="text-muted-foreground">
                  {contact.motivation ||
                    contact.notesSummary ||
                    "No stored preferences yet. Add notes or facts — AI generation is deferred."}
                </p>
              </div>
              <div>
                <p className="font-medium">Stored facts</p>
                {contact.facts.length === 0 ? (
                  <p className="text-muted-foreground">
                    No ContactFact records. Phase 1 does not invent summaries.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {contact.facts.map((f) => (
                      <li key={f.id} className="text-muted-foreground">
                        · {f.statement}{" "}
                        <span className="text-xs">({f.confidence})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium">What happened recently?</p>
                <p className="text-muted-foreground">
                  {contact.activities[0]
                    ? `${contact.activities[0].subject ?? contact.activities[0].type} · ${format(contact.activities[0].occurredAt, "MMM d")}`
                    : "No recent activity."}
                </p>
              </div>
              <div>
                <p className="font-medium">What should I do next?</p>
                <p className="text-muted-foreground">
                  {contact.tasks[0]
                    ? contact.tasks[0].title
                    : contact.opportunities[0]?.nextAction ||
                      "Create a task or opportunity to define the next action."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consent &amp; DNC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Hard-blocks outbound email/SMS when DNC is on or channel consent is off.
              </p>
              <form action={updateConsentAction} className="space-y-2">
                <input type="hidden" name="contactId" value={contact.id} />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="doNotContact"
                    defaultChecked={contact.doNotContact}
                  />
                  Do not contact
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="consentEmail"
                    defaultChecked={contact.consentEmail}
                  />
                  Consent email
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="consentSms" defaultChecked={contact.consentSms} />
                  Consent SMS
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="consentCall" defaultChecked={contact.consentCall} />
                  Consent call
                </label>
                <Button type="submit" size="sm" variant="outline">
                  Save consent
                </Button>
              </form>
              {contact.notesSummary ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{contact.notesSummary}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.opportunities.length === 0 ? (
                <p className="text-muted-foreground">None</p>
              ) : (
                contact.opportunities.map((o) => (
                  <div key={o.id} className="flex justify-between gap-2">
                    <span>{o.title}</span>
                    <span className="text-muted-foreground">{o.pipelineStage.name}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.properties.length === 0 ? (
                <p className="text-muted-foreground">None linked</p>
              ) : (
                contact.properties.map((cp) => (
                  <Link
                    key={cp.id}
                    href={`/app/properties/${cp.property.id}`}
                    className="block hover:underline"
                  >
                    {cp.property.line1} · {cp.role}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.tasks.length === 0 ? (
                <p className="text-muted-foreground">None</p>
              ) : (
                contact.tasks.map((t) => (
                  <div key={t.id}>
                    {t.title}
                    {t.dueAt ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {format(t.dueAt, "MMM d")}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relationships</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.relationshipsFrom.length === 0 && contact.relationshipsTo.length === 0 ? (
                <p className="text-muted-foreground">No graph edges yet</p>
              ) : (
                <>
                  {contact.relationshipsFrom.map((r) => (
                    <div key={r.id}>
                      {r.relationshipType}{" "}
                      <Link href={`/app/contacts/${r.toContact.id}`} className="hover:underline">
                        {r.toContact.firstName} {r.toContact.lastName}
                      </Link>
                    </div>
                  ))}
                  {contact.relationshipsTo.map((r) => (
                    <div key={r.id}>
                      <Link href={`/app/contacts/${r.fromContact.id}`} className="hover:underline">
                        {r.fromContact.firstName} {r.fromContact.lastName}
                      </Link>{" "}
                      → {r.relationshipType} (this contact)
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
