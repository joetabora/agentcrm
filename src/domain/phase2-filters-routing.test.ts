import { describe, expect, it } from "vitest"
import {
  buildOpportunityWhere,
  opportunityFiltersSchema,
  parseOpportunityFilters,
} from "@/domain/opportunities/service"
import { routingRuleMatches } from "@/domain/routing/service"

describe("opportunity filters", () => {
  it("parses query params", () => {
    const filters = parseOpportunityFilters({
      type: "BUYER",
      temperature: "HOT",
      uncontacted: "1",
      openOnly: "true",
      inactiveDays: "14",
      assignee: "me",
    })
    expect(filters.type).toBe("BUYER")
    expect(filters.temperature).toBe("HOT")
    expect(filters.inactiveDays).toBe(14)
    expect(filters.assignee).toBe("me")
  })

  it("rejects invalid temperature via schema", () => {
    expect(opportunityFiltersSchema.safeParse({ temperature: "LUKEWARM" }).success).toBe(false)
  })

  it("builds tenant-scoped where with assignee me", () => {
    const where = buildOpportunityWhere(
      "org1",
      { assignee: "me", type: "SELLER", openOnly: "1" },
      "user1",
    )
    expect(where.organizationId).toBe("org1")
    expect(where.assignedToUserId).toBe("user1")
    expect(where.type).toBe("SELLER")
    expect(where.pipelineStage).toMatchObject({ isTerminal: false })
  })

  it("builds unassigned filter", () => {
    const where = buildOpportunityWhere("org1", { assignee: "unassigned" })
    expect(where.assignedToUserId).toBeNull()
  })
})

describe("routing rule matching", () => {
  it("matches source and type", () => {
    expect(
      routingRuleMatches(
        { type: "BUYER", sourceContains: "zillow" },
        {
          type: "BUYER",
          source: "Zillow Premier",
          temperature: "HOT",
          estimatedValue: 400000,
        },
      ),
    ).toBe(true)
  })

  it("rejects mismatched type", () => {
    expect(
      routingRuleMatches(
        { type: "SELLER" },
        {
          type: "BUYER",
          source: null,
          temperature: "WARM",
          estimatedValue: null,
        },
      ),
    ).toBe(false)
  })

  it("enforces estimated value bounds", () => {
    expect(
      routingRuleMatches(
        { minEstimatedValue: 300000, maxEstimatedValue: 500000 },
        {
          type: "BUYER",
          source: null,
          temperature: "WARM",
          estimatedValue: 250000,
        },
      ),
    ).toBe(false)
    expect(
      routingRuleMatches(
        { minEstimatedValue: 300000, maxEstimatedValue: 500000 },
        {
          type: "BUYER",
          source: null,
          temperature: "WARM",
          estimatedValue: 350000,
        },
      ),
    ).toBe(true)
  })
})
