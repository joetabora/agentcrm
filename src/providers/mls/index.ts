export type MlsListingQuery = {
  mlsNumber?: string
  postalCode?: string
}

export type MlsListingSource =
  | "RESO"
  | "MOCK_FIXTURE"
  | "MANUAL_IMPORT"
  | "IDX"
  | "VOW"

export type MlsListing = {
  listingKey: string
  mlsNumber: string
  line1: string
  line2?: string | null
  city: string
  state: string
  postalCode: string
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  listPrice?: number | null
  status?: string | null
  listedAt?: string | null
  attribution: string
  source: MlsListingSource
}

export interface MlsProvider {
  readonly name: string
  searchListings(query: MlsListingQuery): Promise<MlsListing[]>
}

const FIXTURE_ATTRIBUTION = "Mock fixture — not a live MLS feed"

const FIXTURES: MlsListing[] = [
  {
    listingKey: "fixture-wauwatosa-1",
    mlsNumber: "FIX-1001",
    line1: "7420 W North Ave",
    city: "Wauwatosa",
    state: "WI",
    postalCode: "53213",
    beds: 3,
    baths: 2,
    sqft: 1680,
    listPrice: 389000,
    status: "Active",
    listedAt: "2026-06-01T00:00:00.000Z",
    attribution: FIXTURE_ATTRIBUTION,
    source: "MOCK_FIXTURE",
  },
  {
    listingKey: "fixture-milwaukee-2",
    mlsNumber: "FIX-1002",
    line1: "1845 N Prospect Ave",
    city: "Milwaukee",
    state: "WI",
    postalCode: "53202",
    beds: 2,
    baths: 2,
    sqft: 1200,
    listPrice: 425000,
    status: "Active",
    listedAt: "2026-07-15T00:00:00.000Z",
    attribution: FIXTURE_ATTRIBUTION,
    source: "MOCK_FIXTURE",
  },
  {
    listingKey: "fixture-brookfield-3",
    mlsNumber: "FIX-1003",
    line1: "2100 N Calhoun Rd",
    city: "Brookfield",
    state: "WI",
    postalCode: "53005",
    beds: 4,
    baths: 3,
    sqft: 2450,
    listPrice: 615000,
    status: "Pending",
    listedAt: "2026-05-20T00:00:00.000Z",
    attribution: FIXTURE_ATTRIBUTION,
    source: "MOCK_FIXTURE",
  },
]

/** Labeled fixtures for local/dev — never presented as a real MLS. */
export class FixtureMlsProvider implements MlsProvider {
  readonly name = "fixture"

  async searchListings(query: MlsListingQuery): Promise<MlsListing[]> {
    let rows = [...FIXTURES]
    if (query.mlsNumber?.trim()) {
      const q = query.mlsNumber.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          r.mlsNumber.toLowerCase().includes(q) ||
          r.listingKey.toLowerCase().includes(q),
      )
    }
    if (query.postalCode?.trim()) {
      const z = query.postalCode.trim()
      rows = rows.filter((r) => r.postalCode === z)
    }
    return rows
  }
}

/** @deprecated Use FixtureMlsProvider */
export const MockMlsProvider = FixtureMlsProvider

export type ResoWebApiConfig = {
  baseUrl: string
  accessToken?: string
  tokenUrl?: string
  clientId?: string
  clientSecret?: string
}

/**
 * RESO Web API client (authorized feeds only).
 * Spec: https://www.reso.org/reso-web-api/
 * Does not fabricate listings on failure.
 */
export class ResoWebApiProvider implements MlsProvider {
  readonly name = "reso"

  constructor(private readonly config: ResoWebApiConfig) {}

  private async resolveToken(): Promise<string> {
    if (this.config.accessToken?.trim()) return this.config.accessToken.trim()
    if (
      !this.config.tokenUrl ||
      !this.config.clientId ||
      !this.config.clientSecret
    ) {
      throw new Error(
        "RESO credentials incomplete: need MLS_RESO_ACCESS_TOKEN or token URL + client id/secret",
      )
    }
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })
    const res = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
    if (!res.ok) {
      throw new Error(`RESO token error ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as { access_token?: string }
    if (!json.access_token) throw new Error("RESO token response missing access_token")
    return json.access_token
  }

  async searchListings(query: MlsListingQuery): Promise<MlsListing[]> {
    const token = await this.resolveToken()
    const base = this.config.baseUrl.replace(/\/$/, "")
    const filters: string[] = []
    if (query.mlsNumber?.trim()) {
      const n = query.mlsNumber.trim().replace(/'/g, "''")
      filters.push(`(ListingId eq '${n}' or ListingKey eq '${n}')`)
    }
    if (query.postalCode?.trim()) {
      const z = query.postalCode.trim().replace(/'/g, "''")
      filters.push(`PostalCode eq '${z}'`)
    }
    const params = new URLSearchParams()
    params.set("$top", "50")
    if (filters.length) params.set("$filter", filters.join(" and "))

    const url = `${base}/Property?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) {
      throw new Error(`RESO Property error ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { value?: Record<string, unknown>[] }
    const rows = data.value ?? []
    return rows.map((row) => mapResoProperty(row)).filter((x): x is MlsListing => x != null)
  }
}

function mapResoProperty(row: Record<string, unknown>): MlsListing | null {
  const listingKey = str(row.ListingKey) || str(row.ListingId)
  const mlsNumber = str(row.ListingId) || str(row.ListingKey)
  if (!listingKey || !mlsNumber) return null

  const line1 =
    str(row.UnparsedAddress) ||
    [str(row.StreetNumber), str(row.StreetName), str(row.StreetSuffix)]
      .filter(Boolean)
      .join(" ")
  const city = str(row.City)
  const state = str(row.StateOrProvince)
  const postalCode = str(row.PostalCode)
  if (!line1 || !city || !state || !postalCode) return null

  const attribution =
    str(row.ListingAttributionContact) ||
    str(row.OriginatingSystemName) ||
    "RESO feed — authorized brokerage MLS agreement required"

  return {
    listingKey,
    mlsNumber,
    line1,
    line2: str(row.UnitNumber) || null,
    city,
    state,
    postalCode,
    beds: num(row.BedroomsTotal),
    baths: num(row.BathroomsTotalInteger) ?? num(row.BathroomsFull),
    sqft: int(row.LivingArea),
    listPrice: num(row.ListPrice),
    status: str(row.StandardStatus) || str(row.MlsStatus),
    listedAt: str(row.ListingContractDate) || str(row.OnMarketDate),
    attribution,
    source: "RESO",
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v)
  return null
}

function int(v: unknown): number | null {
  const n = num(v)
  return n == null ? null : Math.round(n)
}

export function hasResoCredentials(): boolean {
  const base = process.env.MLS_RESO_BASE_URL?.trim()
  if (!base) return false
  if (process.env.MLS_RESO_ACCESS_TOKEN?.trim()) return true
  return Boolean(
    process.env.MLS_RESO_TOKEN_URL?.trim() &&
      process.env.MLS_RESO_CLIENT_ID?.trim() &&
      process.env.MLS_RESO_CLIENT_SECRET?.trim(),
  )
}

export function getMlsProvider(): MlsProvider {
  if (hasResoCredentials()) {
    return new ResoWebApiProvider({
      baseUrl: process.env.MLS_RESO_BASE_URL!.trim(),
      accessToken: process.env.MLS_RESO_ACCESS_TOKEN?.trim(),
      tokenUrl: process.env.MLS_RESO_TOKEN_URL?.trim(),
      clientId: process.env.MLS_RESO_CLIENT_ID?.trim(),
      clientSecret: process.env.MLS_RESO_CLIENT_SECRET?.trim(),
    })
  }
  return new FixtureMlsProvider()
}
