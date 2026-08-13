import { differenceInCalendarDays, startOfDay } from "date-fns"
import type { BuyerPreferences } from "@/domain/properties/preferences"
import { parseBuyerPreferences } from "@/domain/properties/preferences"

export const MATCH_WEIGHTS = {
  budgetInRange: 40,
  budgetNear: 20,
  beds: 25,
  baths: 20,
  city: 30,
  zip: 35,
  propertyType: 20,
  domUnderMax: 15,
} as const

/** Statuses considered inventory for matching. */
export const MATCHABLE_STATUSES = ["ACTIVE", "PRE_LISTING", "PENDING", "UNKNOWN"] as const

export type MatchableProperty = {
  id: string
  city: string
  state: string
  postalCode: string
  propertyType: string | null
  beds: number | null
  baths: number | null
  listPrice: number | null
  status: string
  listedAt: Date | null
  line1: string
}

export type MatchBudget = {
  budgetMin: number | null
  budgetMax: number | null
}

export type MatchScore = {
  score: number
  reasons: string[]
  hardFail: boolean
  hardFailReason?: string
}

export function daysOnMarket(listedAt: Date | null | undefined, now = new Date()): number | null {
  if (!listedAt) return null
  return Math.max(0, differenceInCalendarDays(startOfDay(now), startOfDay(listedAt)))
}

export function scorePropertyAgainstPrefs(
  property: MatchableProperty,
  prefs: BuyerPreferences,
  budget: MatchBudget,
  now = new Date(),
): MatchScore {
  let score = 0
  const reasons: string[] = []

  const price =
    property.listPrice != null && !Number.isNaN(Number(property.listPrice))
      ? Number(property.listPrice)
      : null

  if (budget.budgetMax != null) {
    if (price == null) {
      return {
        score: 0,
        reasons: [],
        hardFail: true,
        hardFailReason: "Budget max set but property has no list price",
      }
    }
    if (price > budget.budgetMax * 1.15) {
      return {
        score: 0,
        reasons: [],
        hardFail: true,
        hardFailReason: `Price ${Math.round(price)} exceeds budget max ${budget.budgetMax} by >15%`,
      }
    }
    if (price <= budget.budgetMax) {
      score += MATCH_WEIGHTS.budgetInRange
      reasons.push("Price within budget max")
    } else {
      score += MATCH_WEIGHTS.budgetNear
      reasons.push("Price within 15% over budget max")
    }
  } else if (budget.budgetMin != null && price != null && price >= budget.budgetMin) {
    score += MATCH_WEIGHTS.budgetNear
    reasons.push("Price at or above budget min")
  }

  if (prefs.bedsMin != null) {
    if (property.beds != null && property.beds >= prefs.bedsMin) {
      score += MATCH_WEIGHTS.beds
      reasons.push(`Beds ≥ ${prefs.bedsMin}`)
    } else if (property.beds == null) {
      // no points
    } else {
      return {
        score: 0,
        reasons: [],
        hardFail: true,
        hardFailReason: `Beds ${property.beds} below min ${prefs.bedsMin}`,
      }
    }
  }

  if (prefs.bathsMin != null) {
    if (property.baths != null && property.baths >= prefs.bathsMin) {
      score += MATCH_WEIGHTS.baths
      reasons.push(`Baths ≥ ${prefs.bathsMin}`)
    } else if (property.baths != null && property.baths < prefs.bathsMin) {
      return {
        score: 0,
        reasons: [],
        hardFail: true,
        hardFailReason: `Baths ${property.baths} below min ${prefs.bathsMin}`,
      }
    }
  }

  if (prefs.cities?.length) {
    const city = property.city.trim().toLowerCase()
    if (prefs.cities.some((c) => c.trim().toLowerCase() === city)) {
      score += MATCH_WEIGHTS.city
      reasons.push(`City match: ${property.city}`)
    }
  }

  if (prefs.zips?.length) {
    const zip = property.postalCode.trim()
    if (prefs.zips.some((z) => z.trim() === zip || zip.startsWith(z.trim()))) {
      score += MATCH_WEIGHTS.zip
      reasons.push(`ZIP match: ${property.postalCode}`)
    }
  }

  if (prefs.propertyTypes?.length && property.propertyType) {
    const t = property.propertyType.trim().toLowerCase()
    if (prefs.propertyTypes.some((pt) => pt.trim().toLowerCase() === t)) {
      score += MATCH_WEIGHTS.propertyType
      reasons.push(`Type: ${property.propertyType}`)
    }
  }

  if (prefs.maxDom != null) {
    const dom = daysOnMarket(property.listedAt, now)
    if (dom != null && dom <= prefs.maxDom) {
      score += MATCH_WEIGHTS.domUnderMax
      reasons.push(`DOM ${dom}d ≤ max ${prefs.maxDom}`)
    } else if (dom != null && dom > prefs.maxDom) {
      // soft: no hard fail, just no points
    }
  }

  if (reasons.length === 0 && !score) {
    reasons.push("No preference criteria matched")
  }

  return { score, reasons, hardFail: false }
}

export function toMatchableProperty(p: {
  id: string
  city: string
  state: string
  postalCode: string
  propertyType: string | null
  beds: number | null
  baths: number | null
  listPrice: unknown
  status: string
  listedAt: Date | null
  line1: string
}): MatchableProperty {
  return {
    id: p.id,
    city: p.city,
    state: p.state,
    postalCode: p.postalCode,
    propertyType: p.propertyType,
    beds: p.beds,
    baths: p.baths,
    listPrice: p.listPrice != null ? Number(p.listPrice) : null,
    status: p.status,
    listedAt: p.listedAt,
    line1: p.line1,
  }
}

export function prefsFromContact(contact: {
  preferences: unknown
  budgetMin: unknown
  budgetMax: unknown
}): { prefs: BuyerPreferences; budget: MatchBudget } {
  const prefs = parseBuyerPreferences(contact.preferences)
  return {
    prefs,
    budget: {
      budgetMin: contact.budgetMin != null ? Number(contact.budgetMin) : null,
      budgetMax: contact.budgetMax != null ? Number(contact.budgetMax) : null,
    },
  }
}
