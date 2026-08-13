import { describe, expect, it } from "vitest"
import { assertCanSend, renderTemplate } from "@/domain/comms/consent"
import { isSmsStopBody } from "@/domain/comms/service"

describe("consent gate", () => {
  const base = {
    doNotContact: false,
    consentEmail: true,
    consentSms: true,
    consentCall: true,
  }

  it("blocks do-not-contact", () => {
    const d = assertCanSend({ ...base, doNotContact: true }, "EMAIL")
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toMatch(/do-not-contact/i)
  })

  it("blocks missing channel consent", () => {
    expect(assertCanSend({ ...base, consentEmail: false }, "EMAIL").allowed).toBe(false)
    expect(assertCanSend({ ...base, consentSms: false }, "SMS").allowed).toBe(false)
    expect(assertCanSend({ ...base, consentCall: false }, "CALL").allowed).toBe(false)
  })

  it("allows when consented", () => {
    expect(assertCanSend(base, "EMAIL").allowed).toBe(true)
    expect(assertCanSend(base, "SMS").allowed).toBe(true)
  })
})

describe("template merge", () => {
  it("replaces only known vars", () => {
    expect(
      renderTemplate("Hi {{firstName}} {{lastName}} from {{agentName}} {{unknown}}", {
        firstName: "Ada",
        lastName: "Lovelace",
        agentName: "Joe",
      }),
    ).toBe("Hi Ada Lovelace from Joe {{unknown}}")
  })
})

describe("SMS STOP detection", () => {
  it("detects stop keywords", () => {
    expect(isSmsStopBody("STOP")).toBe(true)
    expect(isSmsStopBody("stop please")).toBe(true)
    expect(isSmsStopBody("UNSUBSCRIBE")).toBe(true)
    expect(isSmsStopBody("hello")).toBe(false)
  })
})
