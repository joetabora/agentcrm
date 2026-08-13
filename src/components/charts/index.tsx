import { cn } from "@/lib/utils"

export function BarChart({
  data,
  className,
  height = 160,
}: {
  data: Array<{ label: string; value: number }>
  className?: string
  height?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const barWidth = 28
  const gap = 16
  const width = Math.max(data.length * (barWidth + gap), 120)
  const chartHeight = height - 28

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-auto w-full text-primary", className)}
      role="img"
      aria-label="Bar chart"
    >
      {data.map((d, i) => {
        const h = (d.value / max) * chartHeight
        const x = i * (barWidth + gap) + gap / 2
        const y = chartHeight - h
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={4}
              className="fill-primary/80"
            />
            <text
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function Sparkline({
  values,
  className,
  width = 120,
  height = 32,
}: {
  values: number[]
  className?: string
  width?: number
  height?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-primary", className)}
      width={width}
      height={height}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  )
}

export function DonutChart({
  value,
  max = 100,
  label,
  className,
  size = 96,
}: {
  value: number
  max?: number
  label?: string
  className?: string
  size?: number
}) {
  const pct = Math.min(1, Math.max(0, value / max))
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)

  return (
    <div className={cn("relative inline-flex", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" className="size-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" className="stroke-muted" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          className="stroke-primary"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums">{Math.round(pct * 100)}%</span>
        {label ? <span className="text-[10px] text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  )
}
