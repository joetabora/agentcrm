import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { createOrganizationForUser } from "@/domain/orgs/service"
import {
  FixtureMlsProvider,
  getMlsProvider,
  hasResoCredentials,
} from "@/providers/mls"
import {
  assertListingImportable,
  importResoJson,
  syncFromProvider,
  upsertMlsListing,
} from "@/domain/mls/service"

const suffix = Date.now().toString(36)

describe("MLS provider", () => {
  it("fixture returns labeled MOCK_FIXTURE source", async () => {
    const p = new FixtureMlsProvider()
    const rows = await p.searchListings({})
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows.every((r) => r.source === "MOCK_FIXTURE")).toBe(true)
    expect(rows[0]?.attribution).toMatch(/not a live MLS/i)
  })

  it("factory uses fixture when RESO env unset", () => {
    const prev = {
      base: process.env.MLS_RESO_BASE_URL,
      token: process.env.MLS_RESO_ACCESS_TOKEN,
    }
    delete process.env.MLS_RESO_BASE_URL
    delete process.env.MLS_RESO_ACCESS_TOKEN
    expect(hasResoCredentials()).toBe(false)
    expect(getMlsProvider().name).toBe("fixture")
    if (prev.base !== undefined) process.env.MLS_RESO_BASE_URL = prev.base
    if (prev.token !== undefined) process.env.MLS_RESO_ACCESS_TOKEN = prev.token
  })

  it("factory picks reso when base + token set", () => {
    const prev = {
      base: process.env.MLS_RESO_BASE_URL,
      token: process.env.MLS_RESO_ACCESS_TOKEN,
    }
    process.env.MLS_RESO_BASE_URL = "https://example.test/reso"
    process.env.MLS_RESO_ACCESS_TOKEN = "test-token"
    expect(hasResoCredentials()).toBe(true)
    expect(getMlsProvider().name).toBe("reso")
    if (prev.base !== undefined) process.env.MLS_RESO_BASE_URL = prev.base
    else delete process.env.MLS_RESO_BASE_URL
    if (prev.token !== undefined) process.env.MLS_RESO_ACCESS_TOKEN = prev.token
    else delete process.env.MLS_RESO_ACCESS_TOKEN
  })
})

describe("MLS upsert / import", () => {
  let userId = ""
  let orgId = ""
  let otherOrgId = ""

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: `MLS ${suffix}`,
        email: `mls-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    userId = user.id
    const org = await createOrganizationForUser({
      userId,
      name: `MLS Org ${suffix}`,
    })
    orgId = org.id

    const otherUser = await prisma.user.create({
      data: {
        name: `MLS Other ${suffix}`,
        email: `mls-other-${suffix}@example.com`,
        emailVerified: true,
      },
    })
    const otherOrg = await createOrganizationForUser({
      userId: otherUser.id,
      name: `MLS Other Org ${suffix}`,
    })
    otherOrgId = otherOrg.id
  })

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [orgId, otherOrgId].filter(Boolean) } },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: [`mls-${suffix}@example.com`, `mls-other-${suffix}@example.com`] },
      },
    })
    await prisma.$disconnect()
  })

  it("upsert sets IMPORTED + attribution", async () => {
    const prop = await upsertMlsListing(orgId, userId, {
      listingKey: `key-${suffix}`,
      mlsNumber: `MLS-${suffix}`,
      line1: "100 Test St",
      city: "Milwaukee",
      state: "WI",
      postalCode: "53202",
      listPrice: 350000,
      status: "Active",
      attribution: "Mock fixture — not a live MLS feed",
      source: "MOCK_FIXTURE",
    })
    expect(prop.provenance).toBe("IMPORTED")
    expect(prop.mlsAttribution).toMatch(/not a live MLS/i)
    expect(prop.mlsListingKey).toBe(`key-${suffix}`)
  })

  it("rejects incomplete listings", () => {
    expect(() =>
      assertListingImportable({
        listingKey: "",
        mlsNumber: "",
        line1: "x",
        city: "y",
        state: "WI",
        postalCode: "53202",
        attribution: "a",
        source: "MANUAL_IMPORT",
      }),
    ).toThrow(/listingKey|mlsNumber/i)
  })

  it("import rejects incomplete RESO rows", async () => {
    const result = await importResoJson(orgId, userId, [
      { ListingKey: "only-key" },
      {
        ListingKey: `ok-${suffix}`,
        ListingId: `OK-${suffix}`,
        UnparsedAddress: "200 Ok Ave",
        City: "Wauwatosa",
        StateOrProvince: "WI",
        PostalCode: "53213",
        ListPrice: 400000,
        StandardStatus: "Active",
      },
    ])
    expect(result.upserted).toBe(1)
    expect(result.errors.length).toBeGreaterThanOrEqual(1)
  })

  it("sync fixtures into org only", async () => {
    const prevBase = process.env.MLS_RESO_BASE_URL
    const prevToken = process.env.MLS_RESO_ACCESS_TOKEN
    delete process.env.MLS_RESO_BASE_URL
    delete process.env.MLS_RESO_ACCESS_TOKEN

    const result = await syncFromProvider(orgId, userId, { postalCode: "53202" })
    expect(result.provider).toBe("fixture")
    expect(result.upserted).toBeGreaterThanOrEqual(1)

    const inOrg = await prisma.property.count({
      where: { organizationId: orgId, mlsSource: "MOCK_FIXTURE" },
    })
    const inOther = await prisma.property.count({
      where: { organizationId: otherOrgId, mlsSource: "MOCK_FIXTURE" },
    })
    expect(inOrg).toBeGreaterThanOrEqual(1)
    expect(inOther).toBe(0)

    if (prevBase !== undefined) process.env.MLS_RESO_BASE_URL = prevBase
    if (prevToken !== undefined) process.env.MLS_RESO_ACCESS_TOKEN = prevToken
  })
})
