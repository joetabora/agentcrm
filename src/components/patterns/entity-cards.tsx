import Link from "next/link"
import { StatusBadge, TemperatureBadge } from "@/components/patterns/status-badge"
import { cn } from "@/lib/utils"

export function ContactCard({
  href,
  name,
  type,
  stage,
  temperature,
  meta,
  className,
}: {
  href: string
  name: string
  type?: string
  stage?: string
  temperature?: string | null
  meta?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:border-primary/30 hover:bg-accent/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <TemperatureBadge value={temperature} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {type ? <StatusBadge tone="outline">{type}</StatusBadge> : null}
        {stage ? <StatusBadge>{stage}</StatusBadge> : null}
      </div>
      {meta ? <p className="mt-2 truncate text-xs text-muted-foreground">{meta}</p> : null}
    </Link>
  )
}

export function LeadCard({
  href,
  title,
  contactName,
  type,
  temperature,
  score,
  budget,
  nextAction,
  className,
}: {
  href: string
  title: string
  contactName?: string
  type?: string
  temperature?: string | null
  score?: number | null
  budget?: string
  nextAction?: string | null
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:border-primary/30 hover:bg-accent/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {contactName ? (
            <p className="truncate text-xs text-muted-foreground">{contactName}</p>
          ) : null}
        </div>
        <TemperatureBadge value={temperature} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {type ? <StatusBadge tone="outline">{type}</StatusBadge> : null}
        {score != null ? (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            Score {score}
          </span>
        ) : null}
        {budget ? (
          <span className="text-xs tabular-nums text-muted-foreground">{budget}</span>
        ) : null}
      </div>
      {nextAction ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">Next: {nextAction}</p>
      ) : null}
    </Link>
  )
}

export function PropertyCard({
  href,
  address,
  cityState,
  price,
  beds,
  baths,
  sqft,
  badge,
  className,
}: {
  href: string
  address: string
  cityState?: string
  price?: string
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  badge?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="flex h-28 items-end bg-gradient-to-br from-primary/15 via-muted to-ai-surface p-3">
        {badge ? <StatusBadge tone="info">{badge}</StatusBadge> : null}
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium text-foreground">{address}</p>
        {cityState ? <p className="truncate text-xs text-muted-foreground">{cityState}</p> : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {price ? (
            <span className="text-sm font-semibold tabular-nums text-foreground">{price}</span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {[beds != null ? `${beds} bd` : null, baths != null ? `${baths} ba` : null, sqft != null ? `${sqft.toLocaleString()} sf` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>
    </Link>
  )
}
