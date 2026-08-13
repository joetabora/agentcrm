import Link from "next/link"
import { notFound } from "next/navigation"
import { getProperty } from "@/domain/properties/service"
import { requireOrgContext } from "@/server/session"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const property = await getProperty(ctx.organization.id, id)
  if (!property) notFound()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{property.line1}</h1>
        <p className="text-muted-foreground">
          {property.city}, {property.state} {property.postalCode}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{property.status}</Badge>
          <Badge variant="outline">{property.provenance}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Beds/Baths: {property.beds ?? "—"} / {property.baths ?? "—"}
            </p>
            <p>Sqft: {property.sqft ?? "—"}</p>
            <p>
              List price:{" "}
              {property.listPrice != null
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(Number(property.listPrice))
                : "—"}
            </p>
            <p>Type: {property.propertyType ?? "—"}</p>
            {property.description ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{property.description}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {property.contacts.length === 0 ? (
              <p className="text-muted-foreground">None</p>
            ) : (
              property.contacts.map((cp) => (
                <Link
                  key={cp.id}
                  href={`/app/contacts/${cp.contact.id}`}
                  className="block hover:underline"
                >
                  {cp.contact.firstName} {cp.contact.lastName} · {cp.role}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
