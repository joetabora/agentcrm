import { describe, expect, it } from "vitest"
import { createContactSchema } from "@/domain/contacts/service"
import { createOpportunitySchema } from "@/domain/opportunities/service"
import { createPropertySchema } from "@/domain/properties/service"
import { createTaskSchema } from "@/domain/tasks/service"

describe("zod schemas", () => {
  it("validates contact create", () => {
    const parsed = createContactSchema.parse({
      firstName: "Jane",
      lastName: "Doe",
      contactType: "BUYER",
      email: "jane@example.com",
    })
    expect(parsed.firstName).toBe("Jane")
  })

  it("rejects invalid opportunity type", () => {
    expect(() =>
      createOpportunitySchema.parse({
        contactId: "x",
        type: "RENTER",
        title: "Nope",
      }),
    ).toThrow()
  })

  it("validates property and task", () => {
    expect(
      createPropertySchema.parse({
        line1: "123 Main",
        city: "Milwaukee",
        state: "WI",
        postalCode: "53202",
      }).city,
    ).toBe("Milwaukee")

    expect(
      createTaskSchema.parse({
        title: "Call lead",
        priority: "URGENT",
      }).priority,
    ).toBe("URGENT")
  })
})
