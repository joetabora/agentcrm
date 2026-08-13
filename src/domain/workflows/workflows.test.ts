import { describe, expect, it } from "vitest"
import { matchesWorkflowConditions } from "@/domain/workflows/conditions"
import {
  findStep,
  parseWorkflowDefinition,
  safeParseWorkflowDefinition,
} from "@/domain/workflows/definition"
import { previewDelayNextRun } from "@/domain/workflows/engine"
import { addHours } from "date-fns"

describe("workflow conditions", () => {
  it("matches temperature and stage", () => {
    expect(
      matchesWorkflowConditions(
        { temperature: "HOT", stageKey: "NEW" },
        { temperature: "HOT", stageKey: "NEW", type: "BUYER", source: "Zillow" },
      ),
    ).toBe(true)
    expect(
      matchesWorkflowConditions(
        { temperature: "HOT" },
        { temperature: "WARM", stageKey: "NEW" },
      ),
    ).toBe(false)
  })

  it("matches sourceContains case-insensitively", () => {
    expect(
      matchesWorkflowConditions(
        { sourceContains: "zillow" },
        { source: "Zillow Premier" },
      ),
    ).toBe(true)
  })
})

describe("workflow definition", () => {
  it("parses a branch + delay + exit graph", () => {
    const def = parseWorkflowDefinition({
      trigger: "OPPORTUNITY_CREATED",
      triggerFilter: { type: "BUYER" },
      steps: [
        {
          key: "branch",
          type: "BRANCH",
          conditions: { temperature: "HOT" },
          nextKey: "task",
          elseKey: "exit",
        },
        {
          key: "task",
          type: "ACTION_CREATE_TASK",
          title: "Call",
          priority: "HIGH",
          nextKey: "delay",
        },
        { key: "delay", type: "DELAY", waitHours: 24, nextKey: "exit" },
        { key: "exit", type: "EXIT" },
      ],
    })
    expect(def.steps).toHaveLength(4)
    expect(findStep(def, "delay")?.type).toBe("DELAY")
    expect(findStep(def, null)?.key).toBe("branch")
  })

  it("rejects empty steps", () => {
    expect(
      safeParseWorkflowDefinition({
        trigger: "MANUAL",
        steps: [],
      }).success,
    ).toBe(false)
  })
})

describe("workflow delay helper", () => {
  it("computes nextRunAt from waitHours", () => {
    const now = new Date("2026-08-12T15:00:00.000Z")
    expect(previewDelayNextRun(2, now).toISOString()).toBe(addHours(now, 2).toISOString())
  })
})
