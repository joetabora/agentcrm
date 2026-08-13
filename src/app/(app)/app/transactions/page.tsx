import Link from "next/link"
import { format } from "date-fns"
import { requireOrgContext } from "@/server/session"
import { listTransactions } from "@/domain/transactions/service"
import {
  EmptyState,
  PageShell,
  StatusBadge,
} from "@/components/patterns"
import { cn } from "@/lib/utils"

function money(v: { toString(): string } | null | undefined) {
  if (v == null) return "—"
  const n = Number(v.toString())
  if (Number.isNaN(n)) return "—"
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "UNDER_CONTRACT", label: "Under contract" },
  { key: "CLOSED", label: "Closed" },
  { key: "FELL_THROUGH", label: "Fell through" },
  { key: "CANCELLED", label: "Cancelled" },
] as const

function statusTone(
  status: string,
): "default" | "info" | "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "CLOSED":
      return "success"
    case "UNDER_CONTRACT":
      return "info"
    case "FELL_THROUGH":
    case "CANCELLED":
      return "destructive"
    case "OPEN":
      return "warning"
    default:
      return "outline"
  }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const status = STATUS_FILTERS.some((s) => s.key && s.key === sp.status)
    ? (sp.status as
        | "OPEN"
        | "UNDER_CONTRACT"
        | "CLOSED"
        | "FELL_THROUGH"
        | "CANCELLED")
    : undefined
  const rows = await listTransactions(
    ctx.organization.id,
    status ? { status } : undefined,
  )

  return (
    <PageShell
      title="Transactions"
      description="Offers, deadlines, checklists, parties, and commission — linked to opportunities."
    >
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const href = f.key ? `/app/transactions?status=${f.key}` : "/app/transactions"
          const active = f.key ? status === f.key : !status
          return (
            <Link
              key={f.key || "all"}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Open one from a lead detail page when an opportunity is under contract."
          actionHref="/app/leads"
          actionLabel="Open leads"
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-[var(--shadow-card)]">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                href={`/app/transactions/${t.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.opportunity.contact.firstName} {t.opportunity.contact.lastName}
                    {t.property ? ` · ${t.property.line1}` : ""}
                    {t.closingDate
                      ? ` · close ${format(t.closingDate, "MMM d, yyyy")}`
                      : ""}
                    {` · ${money(t.purchasePrice)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t._count.offers} offers
                  </span>
                  <StatusBadge tone={statusTone(t.status)}>{t.status}</StatusBadge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
