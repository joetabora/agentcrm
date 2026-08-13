import { describe, expect, it } from "vitest"
import { reportToCsv } from "./csv"
import { median, p90, rate, sourceRoi } from "./math"
import { resolveReportRange } from "./range"
import {
  definitionFromSearchParams,
  parseSourceSpend,
} from "./service"

describe("report range", () => {
  const now = new Date("2026-08-13T15:00:00.000Z")

  it("resolves 30d as 29 days back through end of today", () => {
    const range = resolveReportRange({ preset: "30d" }, now)
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-07-15")
    expect(range.to.getTime()).toBeGreaterThan(range.from.getTime())
  })

  it("resolves ytd from Jan 1", () => {
    const range = resolveReportRange({ preset: "ytd" }, now)
    expect(range.from.getFullYear()).toBe(2026)
    expect(range.from.getMonth()).toBe(0)
    expect(range.from.getDate()).toBe(1)
  })

  it("rejects inverted custom range", () => {
    expect(() =>
      resolveReportRange(
        { preset: "custom", from: "2026-08-10", to: "2026-08-01" },
        now,
      ),
    ).toThrow(/before end/)
  })
})

describe("report math", () => {
  it("computes median and p90", () => {
    expect(median([1, 3, 2])).toBe(2)
    expect(p90([10, 20, 30, 40, 50])).toBe(46)
    expect(median([])).toBeNull()
  })

  it("returns null ROI without spend", () => {
    expect(sourceRoi(1000, undefined)).toBeNull()
    expect(sourceRoi(1000, 0)).toBeNull()
    expect(sourceRoi(250, 100)).toBe(2.5)
  })

  it("closed rate is closed / created", () => {
    expect(rate(2, 8)).toBe(0.25)
    expect(rate(0, 0)).toBeNull()
  })
})

describe("csv", () => {
  it("escapes commas and quotes", () => {
    const csv = reportToCsv(
      [
        { key: "a", label: "Name" },
        { key: "b", label: "Note" },
      ],
      [{ a: "Ada", b: 'said "hi", then left' }],
    )
    expect(csv).toContain("Name,Note")
    expect(csv).toContain('"said ""hi"", then left"')
  })
})

describe("definition parsing", () => {
  it("parses spend keys and type", () => {
    const spend = parseSourceSpend({ "spend:Zillow": "500", type: "SOURCE_ROI" })
    expect(spend).toEqual({ Zillow: 500 })
    const parsed = definitionFromSearchParams({
      type: "GCI",
      preset: "90d",
      opportunityType: "BUYER",
    })
    expect(parsed.type).toBe("GCI")
    expect(parsed.definition.preset).toBe("90d")
    expect(parsed.definition.opportunityType).toBe("BUYER")
  })
})
