import Link from "next/link"
import { format } from "date-fns"
import { requireOrgContext } from "@/server/session"
import { listTransactions } from "@/domain/transactions/service"
import { PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function money(v: { toString(): string } | null | undefined) {
  if (v == null) return "—"
  const n = Number(v.toString())
  if (Number.isNaN(n)) return "—"
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const status = sp.status as
    | "OPEN"
    | "UNDER_CONTRACT"
    | "CLOSED"
    | "FELL_THROUGH"
    | "CANCELLED"
    | undefined
  const rows = await listTransactions(
    ctx.organization.id,
    status ? { status } : undefined,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Offers, deadlines, checklists, parties, and commission — linked to opportunities. Documents use mock storage/esign."
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/app/transactions" className="underline-offset-2 hover:underline">
          All
        </Link>
        {(["OPEN", "UNDER_CONTRACT", "CLOSED"] as const).map((s) => (
          <Link
            key={s}
            href={`/app/transactions?status=${s}`}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            {s}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} transaction{rows.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No transactions yet. Open one from a lead detail page.
            </p>
          ) : (
            rows.map((t) => (
              <Link
                key={t.id}
                href={`/app/transactions/${t.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.opportunity.contact.firstName} {t.opportunity.contact.lastName}
                    {t.property ? ` · ${t.property.line1}` : ""}
                    {t.closingDate
                      ? ` · close ${format(t.closingDate, "MMM d, yyyy")}`
                      : ""}
                    {` · ${money(t.purchasePrice)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t._count.offers} offers
                  </span>
                  <Badge variant="outline">{t.status}</Badge>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
