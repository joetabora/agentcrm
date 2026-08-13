import { describe, expect, it } from "vitest"
import { subDays } from "date-fns"
import {
  daysOnMarket,
  scorePropertyAgainstPrefs,
  type MatchableProperty,
} from "@/domain/properties/match"
import { parseBuyerPreferences, safeParseBuyerPreferences } from "@/domain/properties/preferences"

const baseProperty: MatchableProperty = {
  id: "p1",
  line1: "123 Main",
  city: "Milwaukee",
  state: "WI",
  postalCode: "53202",
  propertyType: "Single Family",
  beds: 3,
  baths: 2,
  listPrice: 350000,
  status: "ACTIVE",
  listedAt: subDays(new Date("2026-08-12"), 10),
}

describe("buyer preferences Fair Housing allowlist", () => {
  it("parses allowlisted keys", () => {
    expect(
      parseBuyerPreferences({
        bedsMin: 3,
        cities: ["Milwaukee"],
        maxDom: 30,
      }),
    ).toEqual({ bedsMin: 3, cities: ["Milwaukee"], maxDom: 30 })
  })

  it("rejects unknown keys", () => {
    const r = safeParseBuyerPreferences({ ethnicity: "x", bedsMin: 2 })
    expect(r.success).toBe(false)
  })

  it("rejects via strict zod extras after allowlist", () => {
    expect(() => parseBuyerPreferences({ schoolRating: 10 })).toThrow(/Disallowed/)
  })
})

describe("match scoring", () => {
  const now = new Date("2026-08-12T12:00:00.000Z")

  it("scores budget + beds + city with reasons", () => {
    const result = scorePropertyAgainstPrefs(
      baseProperty,
      { bedsMin: 3, cities: ["Milwaukee"] },
      { budgetMin: 200000, budgetMax: 400000 },
      now,
    )
    expect(result.hardFail).toBe(false)
    expect(result.score).toBeGreaterThan(0)
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/budget/i),
        expect.stringMatching(/Beds/),
        expect.stringMatching(/City/),
      ]),
    )
  })

  it("hard-fails when price far above budget", () => {
    const result = scorePropertyAgainstPrefs(
      { ...baseProperty, listPrice: 600000 },
      {},
      { budgetMin: null, budgetMax: 400000 },
      now,
    )
    expect(result.hardFail).toBe(true)
  })

  it("hard-fails when beds below min", () => {
    const result = scorePropertyAgainstPrefs(
      { ...baseProperty, beds: 2 },
      { bedsMin: 3 },
      { budgetMin: null, budgetMax: null },
      now,
    )
    expect(result.hardFail).toBe(true)
  })
})

describe("DOM calculation", () => {
  it("returns null without listedAt", () => {
    expect(daysOnMarket(null)).toBeNull()
  })

  it("computes calendar days", () => {
    const now = new Date("2026-08-12T15:00:00.000Z")
    expect(daysOnMarket(subDays(now, 5), now)).toBe(5)
  })
})
