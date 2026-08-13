import { cn } from "@/lib/utils"

const statusStyles = {
  default: "bg-secondary text-secondary-foreground",
  outline: "border border-border bg-background text-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
  ai: "bg-ai-surface text-ai",
  hot: "bg-temp-hot text-temp-hot-foreground",
  warm: "bg-temp-warm text-temp-warm-foreground",
  cold: "bg-temp-cold text-temp-cold-foreground",
} as const

export type StatusBadgeTone = keyof typeof statusStyles

export function StatusBadge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode
  tone?: StatusBadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium tracking-wide whitespace-nowrap",
        statusStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function TemperatureBadge({ value }: { value?: string | null }) {
  if (!value) return null
  const tone: StatusBadgeTone =
    value === "HOT" ? "hot" : value === "WARM" ? "warm" : value === "COLD" ? "cold" : "default"
  return <StatusBadge tone={tone}>{value}</StatusBadge>
}
