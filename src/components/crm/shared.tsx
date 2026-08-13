import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border border-dashed p-6 text-sm",
        className,
      )}
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-2 inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-primary/80"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function TemperatureBadge({ value }: { value?: string | null }) {
  if (!value) return null
  const color =
    value === "HOT"
      ? "bg-red-100 text-red-800"
      : value === "WARM"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700"
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {value}
    </span>
  )
}
