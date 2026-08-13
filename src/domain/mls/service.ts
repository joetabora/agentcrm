import { z } from "zod"
import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type { PropertyStatus } from "@/generated/prisma/client"
import {
  getMlsProvider,
  type MlsListing,
  type MlsListingQuery,
  type MlsListingSource,
} from "@/providers/mls"

const SYNC_CAP = 50

export function mapMlsStatus(status?: string | null): PropertyStatus {
  const s = (status ?? "").toLowerCase()
  if (s.includes("active") || s === "a") return "ACTIVE"
  if (s.includes("pending") || s.includes("contingent")) return "PENDING"
  if (s.includes("sold") || s.includes("closed")) return "SOLD"
  if (s.includes("expire")) return "EXPIRED"
  if (s.includes("withdraw")) return "WITHDRAWN"
  if (s.includes("cancel")) return "CANCELLED"
  if (s.includes("off")) return "OFF_MARKET"
  return "UNKNOWN"
}

export function assertListingImportable(listing: MlsListing) {
  if (!listing.listingKey?.trim() && !listing.mlsNumber?.trim()) {
    throw new Error("Listing requires listingKey or mlsNumber")
  }
  if (!listing.line1?.trim() || !listing.city?.trim() || !listing.state?.trim() || !listing.postalCode?.trim()) {
    throw new Error("Listing requires complete address (line1, city, state, postalCode)")
  }
  if (!listing.attribution?.trim()) {
    throw new Error("Listing requires attribution text")
  }
}

export async function upsertMlsListing(
  organizationId: string,
  actorUserId: string,
  listing: MlsListing,
) {
  assertListingImportable(listing)

  const listingKey = listing.listingKey.trim()
  const mlsNumber = listing.mlsNumber.trim()

  let existing = await prisma.property.findFirst({
    where: {
      organizationId,
      mlsListingKey: listingKey,
    },
  })
  if (!existing && mlsNumber) {
    existing = await prisma.property.findFirst({
      where: { organizationId, mlsNumber },
    })
  }

  const data = {
    line1: listing.line1.trim(),
    line2: listing.line2?.trim() || null,
    city: listing.city.trim(),
    state: listing.state.trim(),
    postalCode: listing.postalCode.trim(),
    beds: listing.beds ?? null,
    baths: listing.baths ?? null,
    sqft: listing.sqft ?? null,
    listPrice: listing.listPrice ?? null,
    status: mapMlsStatus(listing.status),
    mlsNumber,
    mlsListingKey: listingKey,
    mlsSource: listing.source,
    mlsAttribution: listing.attribution,
    mlsLastSyncedAt: new Date(),
    provenance: "IMPORTED" as const,
    listedAt: listing.listedAt ? new Date(listing.listedAt) : null,
  }

  const property = existing
    ? await prisma.property.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.property.create({
        data: {
          organizationId,
          ...data,
        },
      })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Property",
    entityId: property.id,
    action: "MLS_UPSERT",
    after: {
      mlsListingKey: listingKey,
      mlsNumber,
      mlsSource: listing.source,
      created: !existing,
    },
    source: "INTEGRATION",
  })

  return property
}

export async function syncFromProvider(
  organizationId: string,
  actorUserId: string,
  query: MlsListingQuery,
) {
  const provider = getMlsProvider()
  const listings = (await provider.searchListings(query)).slice(0, SYNC_CAP)
  const results = []
  for (const listing of listings) {
    results.push(await upsertMlsListing(organizationId, actorUserId, listing))
  }
  return {
    provider: provider.name,
    upserted: results.length,
    properties: results,
  }
}

const resoImportRowSchema = z.object({
  ListingKey: z.union([z.string(), z.number()]).optional(),
  ListingId: z.union([z.string(), z.number()]).optional(),
  listingKey: z.string().optional(),
  mlsNumber: z.string().optional(),
  UnparsedAddress: z.string().optional(),
  StreetNumber: z.union([z.string(), z.number()]).optional(),
  StreetName: z.string().optional(),
  StreetSuffix: z.string().optional(),
  line1: z.string().optional(),
  UnitNumber: z.string().optional(),
  line2: z.string().optional().nullable(),
  City: z.string().optional(),
  city: z.string().optional(),
  StateOrProvince: z.string().optional(),
  state: z.string().optional(),
  PostalCode: z.union([z.string(), z.number()]).optional(),
  postalCode: z.string().optional(),
  BedroomsTotal: z.number().optional(),
  beds: z.number().optional(),
  BathroomsTotalInteger: z.number().optional(),
  BathroomsFull: z.number().optional(),
  baths: z.number().optional(),
  LivingArea: z.number().optional(),
  sqft: z.number().optional(),
  ListPrice: z.number().optional(),
  listPrice: z.number().optional(),
  StandardStatus: z.string().optional(),
  MlsStatus: z.string().optional(),
  status: z.string().optional(),
  ListingContractDate: z.string().optional(),
  OnMarketDate: z.string().optional(),
  listedAt: z.string().optional().nullable(),
  ListingAttributionContact: z.string().optional(),
  OriginatingSystemName: z.string().optional(),
  attribution: z.string().optional(),
})

function asStr(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

export function mapResoImportRow(
  row: z.infer<typeof resoImportRowSchema>,
  source: MlsListingSource = "MANUAL_IMPORT",
): MlsListing {
  const listingKey =
    asStr(row.listingKey) || asStr(row.ListingKey) || asStr(row.ListingId) || asStr(row.mlsNumber)
  const mlsNumber =
    asStr(row.mlsNumber) || asStr(row.ListingId) || asStr(row.ListingKey) || listingKey
  const line1 =
    asStr(row.line1) ||
    asStr(row.UnparsedAddress) ||
    [asStr(row.StreetNumber), asStr(row.StreetName), asStr(row.StreetSuffix)]
      .filter(Boolean)
      .join(" ")
  const city = asStr(row.city) || asStr(row.City)
  const state = asStr(row.state) || asStr(row.StateOrProvince)
  const postalCode = asStr(row.postalCode) || asStr(row.PostalCode)
  const attribution =
    asStr(row.attribution) ||
    asStr(row.ListingAttributionContact) ||
    asStr(row.OriginatingSystemName) ||
    "Manual RESO-shaped import — verify authorized source"

  return {
    listingKey,
    mlsNumber,
    line1,
    line2: asStr(row.line2) || asStr(row.UnitNumber) || null,
    city,
    state,
    postalCode,
    beds: row.beds ?? row.BedroomsTotal ?? null,
    baths: row.baths ?? row.BathroomsTotalInteger ?? row.BathroomsFull ?? null,
    sqft: row.sqft ?? row.LivingArea ?? null,
    listPrice: row.listPrice ?? row.ListPrice ?? null,
    status: row.status ?? row.StandardStatus ?? row.MlsStatus ?? null,
    listedAt: row.listedAt ?? row.ListingContractDate ?? row.OnMarketDate ?? null,
    attribution,
    source,
  }
}

export async function importResoJson(
  organizationId: string,
  actorUserId: string,
  payload: unknown,
) {
  let rows: unknown[]
  if (Array.isArray(payload)) {
    rows = payload
  } else if (payload && typeof payload === "object" && Array.isArray((payload as { value?: unknown[] }).value)) {
    rows = (payload as { value: unknown[] }).value
  } else if (payload && typeof payload === "object") {
    rows = [payload]
  } else {
    throw new Error("JSON must be an object, array, or { value: [] }")
  }

  const upserted = []
  const errors: { index: number; error: string }[] = []

  for (let i = 0; i < rows.length && upserted.length < SYNC_CAP; i++) {
    try {
      const parsed = resoImportRowSchema.parse(rows[i])
      const listing = mapResoImportRow(parsed, "MANUAL_IMPORT")
      upserted.push(await upsertMlsListing(organizationId, actorUserId, listing))
    } catch (err) {
      errors.push({
        index: i,
        error: err instanceof Error ? err.message : "Invalid row",
      })
    }
  }

  return { upserted: upserted.length, errors, properties: upserted }
}
