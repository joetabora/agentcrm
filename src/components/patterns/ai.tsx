import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AIBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full bg-ai-surface px-2 text-[11px] font-medium text-ai",
        className,
      )}
    >
      <Sparkles className="size-3" />
      AI
    </span>
  )
}

export function AIInsight({
  title,
  subtitle,
  body,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  body?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-ai/20 bg-ai-surface p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <AIBadge />
            {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
          </div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        </div>
      </div>
      {body ? <div className="text-sm text-muted-foreground">{body}</div> : null}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function AIInsightAction({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button size="sm" variant="outline" {...props}>
      {children}
    </Button>
  )
}
