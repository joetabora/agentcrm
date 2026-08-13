import Link from "next/link"
import { notFound } from "next/navigation"
import { addDays, format, isBefore, startOfDay } from "date-fns"
import { requireOrgContext } from "@/server/session"
import { getTransaction } from "@/domain/transactions/service"
import { listContacts } from "@/domain/contacts/service"
import { getStorageProvider } from "@/providers/storage"
import {
  addChecklistItemAction,
  addDeadlineAction,
  addTransactionPartyAction,
  completeDeadlineAction,
  createOfferAction,
  createTransactionDocumentAction,
  setChecklistStatusAction,
  updateOfferStatusAction,
  updateTransactionAction,
} from "@/app/actions"
import {
  NativeSelect,
  NativeTextarea,
  PageShell,
  SectionHeader,
  StatusBadge,
} from "@/components/patterns"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

function money(v: { toString(): string } | null | undefined) {
  if (v == null) return ""
  return v.toString()
}

/** Visual pipeline stages — mapped to deadline kinds / tx status when present. */
const STAGE_PIPELINE: Array<{
  key: "OFFER" | "INSPECTION" | "APPRAISAL" | "FINANCING" | "TITLE" | "WALKTHROUGH" | "CLOSING"
  label: string
  kinds: string[]
}> = [
  { key: "OFFER", label: "Offer", kinds: [] },
  { key: "INSPECTION", label: "Inspection", kinds: ["INSPECTION"] },
  { key: "APPRAISAL", label: "Appraisal", kinds: ["APPRAISAL"] },
  { key: "FINANCING", label: "Financing", kinds: ["FINANCING", "EARNEST_MONEY"] },
  { key: "TITLE", label: "Title", kinds: [] },
  { key: "WALKTHROUGH", label: "Walkthrough", kinds: [] },
  { key: "CLOSING", label: "Closing", kinds: ["CLOSING"] },
]

type DeadlineLike = {
  id: string
  kind: string
  label: string
  dueAt: Date
  completedAt: Date | null
}

function stageState(
  stageKey: (typeof STAGE_PIPELINE)[number]["key"],
  txStatus: string,
  deadlines: DeadlineLike[],
  hasAcceptedOffer: boolean,
): {
  state: "done" | "current" | "upcoming" | "dueSoon" | "overdue"
  dueLabel?: string
} {
  const now = startOfDay(new Date())
  const soon = addDays(now, 7)

  if (txStatus === "CLOSED") {
    return { state: stageKey === "CLOSING" ? "current" : "done" }
  }
  if (txStatus === "FELL_THROUGH" || txStatus === "CANCELLED") {
    return { state: "upcoming" }
  }

  if (stageKey === "OFFER") {
    if (hasAcceptedOffer || txStatus === "UNDER_CONTRACT") return { state: "done" }
    return { state: "current" }
  }

  const kinds = STAGE_PIPELINE.find((s) => s.key === stageKey)?.kinds ?? []
  const related = deadlines.filter((d) => kinds.includes(d.kind))

  if (related.length > 0) {
    const allDone = related.every((d) => d.completedAt)
    if (allDone) return { state: "done" }
    const open = related.filter((d) => !d.completedAt)
    const nearest = open.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0]
    if (nearest) {
      const due = startOfDay(nearest.dueAt)
      if (isBefore(due, now)) {
        return {
          state: "overdue",
          dueLabel: format(nearest.dueAt, "MMM d"),
        }
      }
      if (!isBefore(soon, due)) {
        return {
          state: "dueSoon",
          dueLabel: format(nearest.dueAt, "MMM d"),
        }
      }
      return {
        state: "current",
        dueLabel: format(nearest.dueAt, "MMM d"),
      }
    }
  }

  if (stageKey === "CLOSING" && txStatus === "UNDER_CONTRACT") {
    return { state: "current" }
  }

  // Infer progress from completed earlier stages / offers
  if (stageKey === "TITLE" || stageKey === "WALKTHROUGH") {
    const financingDone = deadlines
      .filter((d) => d.kind === "FINANCING" || d.kind === "APPRAISAL")
      .every((d) => d.completedAt)
    const hasFinancing = deadlines.some(
      (d) => d.kind === "FINANCING" || d.kind === "APPRAISAL",
    )
    if (hasFinancing && financingDone && txStatus === "UNDER_CONTRACT") {
      return { state: stageKey === "TITLE" ? "current" : "upcoming" }
    }
  }

  return { state: "upcoming" }
}

function TransactionStageTimeline({
  status,
  deadlines,
  hasAcceptedOffer,
}: {
  status: string
  deadlines: DeadlineLike[]
  hasAcceptedOffer: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <SectionHeader title="Stage timeline" />
      <ol className="flex min-w-[640px] items-start gap-0">
        {STAGE_PIPELINE.map((stage, index) => {
          const { state, dueLabel } = stageState(
            stage.key,
            status,
            deadlines,
            hasAcceptedOffer,
          )
          const active =
            state === "current" || state === "dueSoon" || state === "overdue"
          return (
            <li key={stage.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                {index > 0 ? (
                  <span
                    className={cn(
                      "h-px flex-1",
                      state === "done" || active ? "bg-primary" : "bg-border",
                    )}
                  />
                ) : (
                  <span className="flex-1" />
                )}
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full ring-4 ring-background",
                    state === "done" && "bg-success",
                    state === "current" && "bg-primary",
                    state === "dueSoon" && "bg-warning",
                    state === "overdue" && "bg-destructive",
                    state === "upcoming" && "bg-muted-foreground/30",
                  )}
                />
                {index < STAGE_PIPELINE.length - 1 ? (
                  <span
                    className={cn(
                      "h-px flex-1",
                      state === "done" ? "bg-primary" : "bg-border",
                    )}
                  />
                ) : (
                  <span className="flex-1" />
                )}
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
                {state === "dueSoon" ? (
                  <StatusBadge tone="warning">Due soon{dueLabel ? ` · ${dueLabel}` : ""}</StatusBadge>
                ) : null}
                {state === "overdue" ? (
                  <StatusBadge tone="destructive">
                    Overdue{dueLabel ? ` · ${dueLabel}` : ""}
                  </StatusBadge>
                ) : null}
                {state === "done" ? (
                  <StatusBadge tone="success">Done</StatusBadge>
                ) : null}
                {state === "current" && dueLabel ? (
                  <span className="text-[10px] text-muted-foreground">{dueLabel}</span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const [tx, contacts] = await Promise.all([
    getTransaction(ctx.organization.id, id),
    listContacts(ctx.organization.id),
  ])
  if (!tx) notFound()

  const storage = getStorageProvider()
  const hasAcceptedOffer = tx.offers.some((o) => o.status === "ACCEPTED")

  return (
    <PageShell
      title={tx.title}
      description={`${tx.side} side · ${tx.opportunity.contact.firstName} ${tx.opportunity.contact.lastName}`}
      actions={
        <Link href="/app/transactions" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Back
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge
          tone={
            tx.status === "CLOSED"
              ? "success"
              : tx.status === "UNDER_CONTRACT"
                ? "info"
                : tx.status === "OPEN"
                  ? "warning"
                  : "destructive"
          }
        >
          {tx.status}
        </StatusBadge>
        <Link
          href={`/app/leads/${tx.opportunityId}`}
          className="text-primary underline-offset-2 hover:underline"
        >
          Opportunity
        </Link>
        {tx.property ? (
          <Link
            href={`/app/properties/${tx.property.id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {tx.property.line1}
          </Link>
        ) : null}
      </div>

      <TransactionStageTimeline
        status={tx.status}
        deadlines={tx.deadlines}
        hasAcceptedOffer={hasAcceptedOffer}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <SectionHeader title="Summary & commission" />
            <form action={updateTransactionAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={tx.title} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <NativeSelect id="status" name="status" defaultValue={tx.status}>
                  {["OPEN", "UNDER_CONTRACT", "CLOSED", "FELL_THROUGH", "CANCELLED"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="side">Side</Label>
                <NativeSelect id="side" name="side" defaultValue={tx.side}>
                  <option value="BUYER">BUYER</option>
                  <option value="SELLER">SELLER</option>
                  <option value="DUAL">DUAL</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purchasePrice">Purchase price</Label>
                <Input
                  id="purchasePrice"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  defaultValue={money(tx.purchasePrice)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="closingDate">Closing date</Label>
                <Input
                  id="closingDate"
                  name="closingDate"
                  type="date"
                  defaultValue={
                    tx.closingDate ? format(tx.closingDate, "yyyy-MM-dd") : ""
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gciAmount">GCI</Label>
                <Input
                  id="gciAmount"
                  name="gciAmount"
                  type="number"
                  step="0.01"
                  defaultValue={money(tx.gciAmount)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agentSplitPercent">Agent split %</Label>
                <Input
                  id="agentSplitPercent"
                  name="agentSplitPercent"
                  type="number"
                  step="0.01"
                  defaultValue={money(tx.agentSplitPercent)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brokerageSplitPercent">Brokerage split %</Label>
                <Input
                  id="brokerageSplitPercent"
                  name="brokerageSplitPercent"
                  type="number"
                  step="0.01"
                  defaultValue={money(tx.brokerageSplitPercent)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <NativeTextarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={tx.notes ?? ""}
                />
              </div>
              <div>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="parties" className="mt-4">
          <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <SectionHeader title="Parties" />
            <ul className="mb-4 divide-y text-sm">
              {tx.parties.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {p.name}
                    {p.email ? ` · ${p.email}` : ""}
                  </span>
                  <StatusBadge tone="outline">{p.role}</StatusBadge>
                </li>
              ))}
            </ul>
            <form action={addTransactionPartyAction} className="grid gap-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <Label>Add party</Label>
              <NativeSelect name="role" defaultValue="OTHER">
                {[
                  "BUYER",
                  "SELLER",
                  "BUYER_AGENT",
                  "SELLER_AGENT",
                  "LENDER",
                  "ATTORNEY",
                  "TITLE",
                  "OTHER",
                ].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="contactId" defaultValue="">
                <option value="">No CRM contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </NativeSelect>
              <Input name="name" placeholder="Name (if no contact)" />
              <Input name="email" placeholder="Email optional" />
              <Button type="submit" size="sm">
                Add party
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="offers" className="mt-4">
          <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <SectionHeader title="Offers" />
            <ul className="mb-4 space-y-2 text-sm">
              {tx.offers.map((o) => (
                <li key={o.id} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium tabular-nums">
                      {Number(o.amount.toString()).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </span>
                    <StatusBadge tone="outline">{o.status}</StatusBadge>
                  </div>
                  <form action={updateOfferStatusAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="offerId" value={o.id} />
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <NativeSelect name="status" defaultValue={o.status} className="flex-1">
                      {[
                        "DRAFT",
                        "SUBMITTED",
                        "COUNTERED",
                        "ACCEPTED",
                        "REJECTED",
                        "WITHDRAWN",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button type="submit" size="sm" variant="outline">
                      Update
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={createOfferAction} className="grid gap-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <Label>New offer amount</Label>
              <Input name="amount" type="number" step="0.01" required />
              <NativeSelect name="status" defaultValue="SUBMITTED">
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
              </NativeSelect>
              <Button type="submit" size="sm">
                Add offer
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="deadlines" className="mt-4">
          <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <SectionHeader title="Deadlines" />
            <ul className="mb-4 divide-y text-sm">
              {tx.deadlines.map((d) => {
                const dueSoon =
                  !d.completedAt &&
                  !isBefore(startOfDay(d.dueAt), startOfDay(new Date())) &&
                  !isBefore(addDays(startOfDay(new Date()), 7), startOfDay(d.dueAt))
                const overdue =
                  !d.completedAt && isBefore(startOfDay(d.dueAt), startOfDay(new Date()))
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">{d.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.kind} · due {format(d.dueAt, "MMM d, yyyy")}
                        {d.completedAt
                          ? ` · done ${format(d.completedAt, "MMM d")}`
                          : ""}
                      </p>
                      {dueSoon ? (
                        <StatusBadge tone="warning" className="mt-1">
                          Due soon
                        </StatusBadge>
                      ) : null}
                      {overdue ? (
                        <StatusBadge tone="destructive" className="mt-1">
                          Overdue
                        </StatusBadge>
                      ) : null}
                    </div>
                    {!d.completedAt ? (
                      <form action={completeDeadlineAction}>
                        <input type="hidden" name="transactionId" value={tx.id} />
                        <input type="hidden" name="deadlineId" value={d.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Complete
                        </Button>
                      </form>
                    ) : (
                      <StatusBadge tone="success">DONE</StatusBadge>
                    )}
                  </li>
                )
              })}
            </ul>
            <form action={addDeadlineAction} className="grid gap-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <NativeSelect name="kind" defaultValue="OTHER">
                {[
                  "INSPECTION",
                  "FINANCING",
                  "APPRAISAL",
                  "EARNEST_MONEY",
                  "CLOSING",
                  "OTHER",
                ].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </NativeSelect>
              <Input name="label" placeholder="Label" required />
              <Input name="dueAt" type="date" required />
              <Button type="submit" size="sm">
                Add deadline
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <SectionHeader title="Checklist" />
            <ul className="mb-4 divide-y text-sm">
              {tx.checklist.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                  <span className={item.status === "DONE" ? "line-through opacity-70" : ""}>
                    {item.title}
                  </span>
                  <form action={setChecklistStatusAction} className="flex gap-1">
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <NativeSelect name="status" defaultValue={item.status} className="w-auto">
                      <option value="TODO">TODO</option>
                      <option value="DONE">DONE</option>
                      <option value="NA">NA</option>
                    </NativeSelect>
                    <Button type="submit" size="sm" variant="outline">
                      Set
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addChecklistItemAction} className="flex gap-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <Input name="title" placeholder="New item" required className="flex-1" />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <SectionHeader title="Documents" />
            <p className="mb-3 text-xs text-muted-foreground">
              Storage provider: {storage.name}. Live DocuSign is not wired — envelopes are mock
              ids only.
            </p>
            <ul className="mb-4 space-y-2 text-sm">
              {tx.documents.map((d) => (
                <li key={d.id} className="rounded-lg border px-3 py-2">
                  <p className="font-medium">{d.name}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    key: {d.storageKey}
                    {d.esignEnvelopeId ? ` · envelope: ${d.esignEnvelopeId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
            <form action={createTransactionDocumentAction} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="docName">Document name</Label>
                <Input id="docName" name="name" required placeholder="Purchase agreement.pdf" />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="createEnvelope" value="1" />
                Create mock esign envelope
              </label>
              <div>
                <Button type="submit" size="sm">
                  Add document placeholder
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
