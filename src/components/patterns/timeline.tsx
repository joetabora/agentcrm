import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type TimelineItem = {
  id: string
  title: string
  meta?: string
  body?: ReactNode
  badge?: ReactNode
}

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[]
  className?: string
}) {
  if (items.length === 0) return null
  return (
    <ul className={cn("space-y-0", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          <div className="flex flex-col items-center">
            <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-background" />
            {index < items.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-border" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.badge}
            </div>
            {item.meta ? <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p> : null}
            {item.body ? <div className="mt-1 text-sm text-muted-foreground">{item.body}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
