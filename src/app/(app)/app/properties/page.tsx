import Link from "next/link"
import { listProperties } from "@/domain/properties/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PropertyStatus } from "@/generated/prisma/client"

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    city?: string
    minPrice?: string
    maxPrice?: string
  }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const status =
    params.status &&
    [
      "UNKNOWN",
      "PRE_LISTING",
      "ACTIVE",
      "PENDING",
      "SOLD",
      "EXPIRED",
      "WITHDRAWN",
      "CANCELLED",
      "OFF_MARKET",
    ].includes(params.status)
      ? (params.status as PropertyStatus)
      : undefined

  const properties = await listProperties(ctx.organization.id, {
    q: params.q,
    status,
    city: params.city,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
  })

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Org inventory matching — MLS deferred"
        actions={
          <Link
            href="/app/properties/new"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
          >
            New property
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search address or city"
          className="h-8 min-w-[180px] flex-1 rounded-lg border bg-background px-3 text-sm"
        />
        <input
          name="city"
          defaultValue={params.city}
          placeholder="City exact"
          className="h-8 w-32 rounded-lg border bg-background px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Any status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PENDING">PENDING</option>
          <option value="PRE_LISTING">PRE_LISTING</option>
          <option value="SOLD">SOLD</option>
        </select>
        <input
          name="minPrice"
          defaultValue={params.minPrice}
          placeholder="Min $"
          type="number"
          className="h-8 w-24 rounded-lg border bg-background px-2 text-sm"
        />
        <input
          name="maxPrice"
          defaultValue={params.maxPrice}
          placeholder="Max $"
          type="number"
          className="h-8 w-24 rounded-lg border bg-background px-2 text-sm"
        />
        <button type="submit" className="h-8 rounded-lg border px-3 text-sm">
          Filter
        </button>
      </form>

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Add listings or homes of interest. Provenance is USER_ENTERED until MLS is authorized."
          actionHref="/app/properties/new"
          actionLabel="Add property"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Beds/Baths</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Provenance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/app/properties/${p.id}`} className="font-medium hover:underline">
                      {p.line1}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.city}, {p.state}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.beds ?? "—"}/{p.baths ?? "—"}
                  </TableCell>
                  <TableCell>
                    {p.listPrice != null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(Number(p.listPrice))
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.provenance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
