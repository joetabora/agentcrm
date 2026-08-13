import type { ReactNode } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}

/** Header-only alias used by many existing pages */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return <PageShell title={title} description={description} actions={actions} />
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {action}
    </div>
  )
}

export function Metric({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  action,
  className,
}: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted/30 p-8 text-sm",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="max-w-md text-muted-foreground">{description}</p>
      </div>
      {action
        ? action
        : actionHref && actionLabel
          ? (
              <Link href={actionHref} className={cn(buttonVariants({ size: "sm" }))}>
                {actionLabel}
              </Link>
            )
          : null}
    </div>
  )
}
