import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
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
import { ContactAiBrief } from "@/components/contacts/contact-ai-brief"
import { ContactDetailTabs } from "@/components/contacts/contact-detail-tabs"
import {
  EmptyState,
  NativeSelect,
  NativeTextarea,
  SectionHeader,
  StatusBadge,
  TemperatureBadge,
  Timeline,
} from "@/components/patterns"
import { ContactDetailOfflineBridge } from "@/components/pwa/contact-detail-offline-bridge"
import { ContactNoteForm } from "@/components/pwa/contact-note-form"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { StashedContactDetail } from "@/lib/offline/types"
import { cn } from "@/lib/utils"

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; tab?: string }>
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

  const stashedDetail: StashedContactDetail = {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    contactType: contact.contactType,
    lifecycleStage: contact.lifecycleStage,
    temperature: contact.temperature,
    source: contact.source,
    email: email ?? null,
    phone: phone ?? null,
    notesSummary: contact.notesSummary,
    activities: contact.activities.slice(0, 40).map((a) => ({
      id: a.id,
      type: a.type,
      subject: a.subject,
      body: a.body,
      occurredAt: a.occurredAt.toISOString(),
    })),
  }

  const overview = (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Identity" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Type</dt>
            <dd className="mt-0.5 font-medium">{contact.contactType}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Lifecycle</dt>
            <dd className="mt-0.5 font-medium">{contact.lifecycleStage}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source</dt>
            <dd className="mt-0.5 font-medium">{contact.source ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Preferred name</dt>
            <dd className="mt-0.5 font-medium">{contact.preferredName ?? "—"}</dd>
          </div>
          {(contact.relationshipsFrom.length > 0 || contact.relationshipsTo.length > 0) && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Relationships</dt>
              <dd className="mt-1 space-y-1">
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
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Buyer preferences" />
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
            <Input id="cities" name="cities" defaultValue={prefs.cities?.join(", ") ?? ""} />
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
            <Input id="maxDom" name="maxDom" type="number" defaultValue={prefs.maxDom ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              Save preferences
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader
          title="Opportunities"
          action={
            <Link
              href={`/app/leads/new?contactId=${contact.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Create
            </Link>
          }
        />
        {contact.opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contact.opportunities.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2">
                <Link href={`/app/leads/${o.id}`} className="font-medium hover:underline">
                  {o.title}
                </Link>
                <StatusBadge>{o.pipelineStage.name}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Consent & DNC" />
        <p className="mb-3 text-xs text-muted-foreground">
          Hard-blocks outbound email/SMS when DNC is on or channel consent is off.
        </p>
        <form action={updateConsentAction} className="space-y-2 text-sm">
          <input type="hidden" name="contactId" value={contact.id} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="doNotContact" defaultChecked={contact.doNotContact} />
            Do not contact
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="consentEmail" defaultChecked={contact.consentEmail} />
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
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {contact.notesSummary}
          </p>
        ) : null}
      </section>
    </div>
  )

  const activity = (
    <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <SectionHeader title="Timeline" />
      <div className="mb-4">
        <ContactNoteForm contactId={contact.id} />
      </div>
      {contact.activities.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Notes, stage changes, and tasks will appear here chronologically."
        />
      ) : (
        <Timeline
          items={contact.activities.map((a) => ({
            id: a.id,
            title: a.subject ?? a.type,
            meta: [
              format(a.occurredAt, "MMM d, yyyy h:mm a"),
              a.actor?.name,
            ]
              .filter(Boolean)
              .join(" · "),
            badge: <StatusBadge tone="outline">{a.type}</StatusBadge>,
            body: a.body ? (
              <p className="whitespace-pre-wrap">{a.body}</p>
            ) : undefined,
          }))}
        />
      )}
    </section>
  )

  const properties = (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Linked properties" />
        {contact.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">None linked</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {contact.properties.map((cp) => (
              <li key={cp.id}>
                <Link
                  href={`/app/properties/${cp.property.id}`}
                  className="font-medium hover:underline"
                >
                  {cp.property.line1}
                </Link>
                <span className="text-muted-foreground"> · {cp.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Matching properties" />
        {propertyMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matches yet. Save preferences on Overview; scores use org inventory only.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {propertyMatches.map((m) => (
              <li key={m.property.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/app/properties/${m.property.id}`}
                    className="font-medium hover:underline"
                  >
                    {m.property.line1}, {m.property.city}
                  </Link>
                  <StatusBadge tone="info">score {m.score}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
                <form action={saveBuyerInterestAction} className="mt-2">
                  <input type="hidden" name="contactId" value={contact.id} />
                  <input type="hidden" name="propertyId" value={m.property.id} />
                  <input type="hidden" name="redirectTo" value={`/app/contacts/${contact.id}`} />
                  <Button type="submit" size="sm" variant="outline">
                    Save interest
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )

  const messages = (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <SectionHeader title="Send message" />
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={sendEmailAction} className="space-y-2 rounded-lg border p-3">
            <input type="hidden" name="contactId" value={contact.id} />
            <p className="text-xs text-muted-foreground">
              Email via <strong>{emailProvider}</strong>
              {!contact.consentEmail || contact.doNotContact
                ? " · blocked until consent/DNC allows"
                : ""}
            </p>
            <NativeSelect name="templateId" defaultValue="">
              <option value="">No template</option>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
            <Input name="subject" placeholder="Subject" defaultValue="" />
            <NativeTextarea name="body" rows={4} placeholder="Hi {{firstName}}…" />
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
            <NativeSelect name="templateId" defaultValue="">
              <option value="">No template</option>
              {smsTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
            <NativeTextarea name="body" rows={4} placeholder="Hi {{firstName}}, …" />
            <Button type="submit" size="sm" disabled={!phone}>
              Send SMS
            </Button>
          </form>
        </div>
      </section>

      {threads.length > 0 ? (
        <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <SectionHeader title="Message threads" />
          <div className="space-y-4">
            {threads.map((th) => (
              <div key={th.id} className="rounded-lg border p-3">
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
          </div>
        </section>
      ) : (
        <EmptyState
          title="No threads yet"
          description="Sent email and SMS conversations will appear here."
        />
      )}
    </div>
  )

  const tasks = (
    <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <SectionHeader
        title="Open tasks"
        action={
          <Link
            href={`/app/tasks?contactId=${contact.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Add task
          </Link>
        }
      />
      {contact.tasks.length === 0 ? (
        <EmptyState
          title="No open tasks"
          description="Create a task to track the next follow-up."
          actionHref={`/app/tasks?contactId=${contact.id}`}
          actionLabel="Add task"
        />
      ) : (
        <ul className="space-y-2 text-sm">
          {contact.tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <span className="font-medium">{t.title}</span>
              {t.dueAt ? (
                <span className="text-xs text-muted-foreground">{format(t.dueAt, "MMM d")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <ContactDetailOfflineBridge detail={stashedDetail}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {contact.firstName} {contact.lastName}
              </h1>
              <StatusBadge tone="outline">{contact.contactType}</StatusBadge>
              <TemperatureBadge value={contact.temperature} />
              <StatusBadge>{contact.lifecycleStage}</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
              {contact.source ? `Source: ${contact.source}` : "No source set"}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {email ? (
                <a href={`mailto:${email}`} className="hover:underline">
                  {email}
                </a>
              ) : null}
              {phone ? (
                <a href={`tel:${phone}`} className="hover:underline">
                  {phone}
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {phone ? (
              <a href={`tel:${phone}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Call
              </a>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Email
              </a>
            ) : null}
            {phone ? (
              <Link
                href={`/app/contacts/${contact.id}?tab=messages`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Text
              </Link>
            ) : null}
            <Link
              href={`/app/tasks?contactId=${contact.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Task
            </Link>
            <Link
              href={`/app/leads/new?contactId=${contact.id}`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Create opportunity
            </Link>
            {manualWorkflows.length > 0 ? (
              <form action={enrollWorkflowAction} className="inline-flex h-7 items-center gap-1">
                <input type="hidden" name="contactId" value={contact.id} />
                <input type="hidden" name="redirectTo" value={`/app/contacts/${contact.id}`} />
                <NativeSelect name="workflowId" required className="w-auto min-w-[140px]">
                  {manualWorkflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="submit" size="sm" variant="outline">
                  Enroll
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        {sp.error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {sp.error}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <ContactDetailTabs
            defaultTab={sp.tab}
            overview={overview}
            activity={activity}
            properties={properties}
            messages={messages}
            tasks={tasks}
          />
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <ContactAiBrief
              contactId={contact.id}
              preferredName={contact.preferredName}
              firstName={contact.firstName}
              lastName={contact.lastName}
              contactType={contact.contactType}
              motivation={contact.motivation}
              notesSummary={contact.notesSummary}
              facts={contact.facts}
              recentActivity={contact.activities[0]}
              nextTask={contact.tasks[0]}
              nextOpportunityAction={contact.opportunities[0]}
            />
          </aside>
        </div>
      </div>
    </ContactDetailOfflineBridge>
  )
}
