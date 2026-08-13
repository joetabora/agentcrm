import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { addNoteAction } from "@/app/actions"
import { getContact } from "@/domain/contacts/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, TemperatureBadge } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const contact = await getContact(ctx.organization.id, id)
  if (!contact) notFound()

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
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
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
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Do not contact:</span>{" "}
                {contact.doNotContact ? "Yes" : "No"}
              </p>
              <p>
                <span className="text-muted-foreground">Consent email/SMS/call:</span>{" "}
                {contact.consentEmail ? "E" : "—"}/{contact.consentSms ? "S" : "—"}/
                {contact.consentCall ? "C" : "—"}
              </p>
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
