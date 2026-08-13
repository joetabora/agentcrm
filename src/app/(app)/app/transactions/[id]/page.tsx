import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
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
import { PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function money(v: { toString(): string } | null | undefined) {
  if (v == null) return ""
  return v.toString()
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx.title}
        description={`${tx.side} side · ${tx.opportunity.contact.firstName} ${tx.opportunity.contact.lastName}`}
        actions={
          <Link
            href="/app/transactions"
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
          >
            Back
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">{tx.status}</Badge>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary &amp; commission</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateTransactionAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="transactionId" value={tx.id} />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={tx.title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={tx.status}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                {["OPEN", "UNDER_CONTRACT", "CLOSED", "FELL_THROUGH", "CANCELLED"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="side">Side</Label>
              <select
                id="side"
                name="side"
                defaultValue={tx.side}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="BUYER">BUYER</option>
                <option value="SELLER">SELLER</option>
                <option value="DUAL">DUAL</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase price</Label>
              <Input
                id="purchasePrice"
                name="purchasePrice"
                type="number"
                step="0.01"
                defaultValue={money(tx.purchasePrice)}
              />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="gciAmount">GCI</Label>
              <Input
                id="gciAmount"
                name="gciAmount"
                type="number"
                step="0.01"
                defaultValue={money(tx.gciAmount)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentSplitPercent">Agent split %</Label>
              <Input
                id="agentSplitPercent"
                name="agentSplitPercent"
                type="number"
                step="0.01"
                defaultValue={money(tx.agentSplitPercent)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brokerageSplitPercent">Brokerage split %</Label>
              <Input
                id="brokerageSplitPercent"
                name="brokerageSplitPercent"
                type="number"
                step="0.01"
                defaultValue={money(tx.brokerageSplitPercent)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={tx.notes ?? ""}
              />
            </div>
            <div>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {tx.parties.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>
                    {p.name}
                    {p.email ? ` · ${p.email}` : ""}
                  </span>
                  <Badge variant="outline">{p.role}</Badge>
                </li>
              ))}
            </ul>
            <form action={addTransactionPartyAction} className="grid gap-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <Label>Add party</Label>
              <select
                name="role"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                defaultValue="OTHER"
              >
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
              </select>
              <select
                name="contactId"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                defaultValue=""
              >
                <option value="">No CRM contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
              <Input name="name" placeholder="Name (if no contact)" />
              <Input name="email" placeholder="Email optional" />
              <Button type="submit" size="sm">
                Add party
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm">
              {tx.offers.map((o) => (
                <li key={o.id} className="rounded border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {Number(o.amount.toString()).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </span>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>
                  <form action={updateOfferStatusAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="offerId" value={o.id} />
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <select
                      name="status"
                      defaultValue={o.status}
                      className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                    >
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
                    </select>
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
              <select
                name="status"
                defaultValue="SUBMITTED"
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
              </select>
              <Button type="submit" size="sm">
                Add offer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm">
              {tx.deadlines.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{d.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.kind} · due {format(d.dueAt, "MMM d, yyyy")}
                      {d.completedAt
                        ? ` · done ${format(d.completedAt, "MMM d")}`
                        : ""}
                    </p>
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
                    <Badge variant="outline">DONE</Badge>
                  )}
                </li>
              ))}
            </ul>
            <form action={addDeadlineAction} className="grid gap-2">
              <input type="hidden" name="transactionId" value={tx.id} />
              <select
                name="kind"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                defaultValue="OTHER"
              >
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
              </select>
              <Input name="label" placeholder="Label" required />
              <Input name="dueAt" type="date" required />
              <Button type="submit" size="sm">
                Add deadline
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm">
              {tx.checklist.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className={item.status === "DONE" ? "line-through opacity-70" : ""}>
                    {item.title}
                  </span>
                  <form action={setChecklistStatusAction} className="flex gap-1">
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="h-8 rounded-md border bg-background px-1 text-xs"
                    >
                      <option value="TODO">TODO</option>
                      <option value="DONE">DONE</option>
                      <option value="NA">NA</option>
                    </select>
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Storage provider: {storage.name}. Live DocuSign is not wired — envelopes are mock
            ids only.
          </p>
          <ul className="space-y-2 text-sm">
            {tx.documents.map((d) => (
              <li key={d.id} className="rounded border p-2">
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground break-all">
                  key: {d.storageKey}
                  {d.esignEnvelopeId ? ` · envelope: ${d.esignEnvelopeId}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <form action={createTransactionDocumentAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="transactionId" value={tx.id} />
            <div className="space-y-2 sm:col-span-2">
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
        </CardContent>
      </Card>
    </div>
  )
}
