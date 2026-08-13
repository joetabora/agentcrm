import { z } from "zod"

/** Fair Housing allowlist — unknown keys are rejected. */
export const ALLOWED_PREF_KEYS = [
  "bedsMin",
  "bathsMin",
  "propertyTypes",
  "cities",
  "zips",
  "maxDom",
] as const

export const buyerPreferencesSchema = z
  .object({
    bedsMin: z.number().nonnegative().optional(),
    bathsMin: z.number().nonnegative().optional(),
    propertyTypes: z.array(z.string().min(1).max(100)).max(20).optional(),
    cities: z.array(z.string().min(1).max(100)).max(50).optional(),
    zips: z.array(z.string().min(1).max(20)).max(50).optional(),
    maxDom: z.number().int().positive().max(3650).optional(),
  })
  .strict()

export type BuyerPreferences = z.infer<typeof buyerPreferencesSchema>

export const updateBuyerPreferencesSchema = z.object({
  budgetMin: z.coerce.number().nonnegative().optional().nullable(),
  budgetMax: z.coerce.number().nonnegative().optional().nullable(),
  preferences: buyerPreferencesSchema.default({}),
})

export type UpdateBuyerPreferencesInput = z.input<typeof updateBuyerPreferencesSchema>

export function parseBuyerPreferences(raw: unknown): BuyerPreferences {
  if (raw == null) return {}
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const unknown = Object.keys(obj).filter(
      (k) => !(ALLOWED_PREF_KEYS as readonly string[]).includes(k),
    )
    if (unknown.length > 0) {
      throw new Error(`Disallowed preference keys (Fair Housing allowlist): ${unknown.join(", ")}`)
    }
  }
  return buyerPreferencesSchema.parse(raw)
}

export function safeParseBuyerPreferences(raw: unknown) {
  try {
    return { success: true as const, data: parseBuyerPreferences(raw) }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Invalid preferences",
    }
  }
}

/** Parse comma/newline separated list into trimmed unique strings. */
export function parseListField(value: string | null | undefined): string[] | undefined {
  if (!value?.trim()) return undefined
  const items = value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length ? [...new Set(items)] : undefined
}
