export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0]
  const clamped = Math.min(1, Math.max(0, p))
  const idx = (sorted.length - 1) * clamped
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const weight = idx - lo
  return sorted[lo] * (1 - weight) + sorted[hi] * weight
}

export function median(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b)
  return percentile(sorted, 0.5)
}

export function p90(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b)
  return percentile(sorted, 0.9)
}

export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return numerator / denominator
}

export function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10
}

export function sourceRoi(gci: number, spend: number | undefined): number | null {
  if (spend == null || spend <= 0) return null
  return gci / spend
}

export function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value.toString())
  return Number.isNaN(n) ? null : n
}
