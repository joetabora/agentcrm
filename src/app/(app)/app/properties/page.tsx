import Link from "next/link"
import { listProperties } from "@/domain/properties/service"
import { requireOrgContext } from "@/server/session"
import {
  EmptyState,
  NativeSelect,
  PageShell,
  PropertyCard,
  SearchInput,
  StatusBadge,
} from "@/components/patterns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buttonVariants } from "@/components/ui/button"
import type { PropertyStatus } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"

function formatPrice(value: unknown) {
  if (value == null) return undefined
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function propertyStatusTone(status: string) {
  if (status === "ACTIVE") return "success" as const
  if (status === "PENDING") return "warning" as const
  if (status === "SOLD") return "info" as const
  if (status === "EXPIRED" || status === "WITHDRAWN" || status === "CANCELLED") {
    return "destructive" as const
  }
  return "outline" as const
}

function buildViewHref(
  view: "cards" | "table",
  params: {
    q?: string
    status?: string
    city?: string
    minPrice?: string
    maxPrice?: string
  },
) {
  const sp = new URLSearchParams()
  if (view !== "cards") sp.set("view", view)
  if (params.q) sp.set("q", params.q)
  if (params.status) sp.set("status", params.status)
  if (params.city) sp.set("city", params.city)
  if (params.minPrice) sp.set("minPrice", params.minPrice)
  if (params.maxPrice) sp.set("maxPrice", params.maxPrice)
  const q = sp.toString()
  return q ? `/app/properties?${q}` : "/app/properties"
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    city?: string
    minPrice?: string
    maxPrice?: string
    view?: string
  }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const view = params.view === "table" ? "table" : "cards"
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

  const filterParams = {
    q: params.q,
    status: params.status,
    city: params.city,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
  }

  return (
    <PageShell
      title="Properties"
      description="Org inventory. Use Settings → MLS for authorized fixture/RESO sync and JSON import."
      actions={
        <Link href="/app/properties/new" className={cn(buttonVariants({ size: "sm" }))}>
          New property
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Link
            href={buildViewHref("cards", filterParams)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium",
              view === "cards"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Cards
          </Link>
          <Link
            href={buildViewHref("table", filterParams)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium",
              view === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Table
          </Link>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        {view === "table" ? <input type="hidden" name="view" value="table" /> : null}
        <SearchInput
          name="q"
          defaultValue={params.q}
          placeholder="Search address or city"
          className="min-w-[180px] flex-1"
        />
        <input
          name="city"
          defaultValue={params.city}
          placeholder="City exact"
          className="h-9 w-32 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <NativeSelect name="status" defaultValue={params.status ?? ""} className="w-auto">
          <option value="">Any status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PENDING">PENDING</option>
          <option value="PRE_LISTING">PRE_LISTING</option>
          <option value="SOLD">SOLD</option>
          <option value="OFF_MARKET">OFF_MARKET</option>
        </NativeSelect>
        <input
          name="minPrice"
          defaultValue={params.minPrice}
          placeholder="Min $"
          type="number"
          className="h-8 w-24 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          name="maxPrice"
          defaultValue={params.maxPrice}
          placeholder="Max $"
          type="number"
          className="h-8 w-24 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
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
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              href={`/app/properties/${p.id}`}
              address={p.line1}
              cityState={`${p.city}, ${p.state}`}
              price={formatPrice(p.listPrice)}
              beds={p.beds}
              baths={p.baths != null ? Number(p.baths) : null}
              sqft={p.sqft}
              badge={p.status}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Beds/Baths</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="hidden md:table-cell">Provenance</TableHead>
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
                    <StatusBadge tone={propertyStatusTone(p.status)}>{p.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.beds ?? "—"}/{p.baths ?? "—"}
                  </TableCell>
                  <TableCell>{formatPrice(p.listPrice) ?? "—"}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {p.provenance}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  )
}
