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

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const properties = await listProperties(ctx.organization.id, { q: params.q })

  return (
    <div>
      <PageHeader
        title="Properties"
        description="User-entered property records (MLS deferred)"
        actions={
          <Link
            href="/app/properties/new"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
          >
            New property
          </Link>
        }
      />

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search address or city"
          className="h-8 min-w-[220px] flex-1 rounded-lg border bg-background px-3 text-sm"
        />
        <button type="submit" className="h-8 rounded-lg border px-3 text-sm">
          Search
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
