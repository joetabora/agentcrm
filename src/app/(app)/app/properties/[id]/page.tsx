import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  addPriceEventAction,
  saveBuyerInterestAction,
  updateListedAtAction,
} from "@/app/actions"
import {
  getProperty,
  matchContactsForProperty,
} from "@/domain/properties/service"
import { daysOnMarket } from "@/domain/properties/match"
import { requireOrgContext } from "@/server/session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext()
  const { id } = await params
  const property = await getProperty(ctx.organization.id, id)
  if (!property) notFound()

  const matches = await matchContactsForProperty(ctx.organization.id, id)
  const dom = daysOnMarket(property.listedAt)

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
          {dom != null ? (
            <Badge variant="outline">DOM {dom}d · CALCULATED</Badge>
          ) : (
            <Badge variant="outline">DOM unknown</Badge>
          )}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing date &amp; DOM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              DOM is CALCULATED from agent-entered listedAt. Never invented from MLS.
            </p>
            <form action={updateListedAtAction} className="space-y-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <Label htmlFor="listedAt">Listed at</Label>
              <Input
                id="listedAt"
                name="listedAt"
                type="date"
                defaultValue={
                  property.listedAt ? format(property.listedAt, "yyyy-MM-dd") : ""
                }
              />
              <Button type="submit" size="sm" variant="outline">
                Save listed date
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <form action={addPriceEventAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <div className="space-y-1">
                <Label htmlFor="price">New price</Label>
                <Input id="price" name="price" type="number" required className="w-36" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="note">Note</Label>
                <Input id="note" name="note" className="w-40" placeholder="Price reduction" />
              </div>
              <Button type="submit" size="sm">
                Record
              </Button>
            </form>
            {property.priceEvents.length === 0 ? (
              <p className="text-muted-foreground">No price events yet (USER_ENTERED).</p>
            ) : (
              <ul className="space-y-2">
                {property.priceEvents.map((e) => (
                  <li key={e.id} className="border-l-2 pl-3">
                    <p className="font-medium">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(Number(e.price))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(e.notedAt, "MMM d, yyyy")} · {e.provenance}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matching buyers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {matches.length === 0 ? (
            <p className="text-muted-foreground">
              No scoring buyers yet. Set budget/prefs on contacts (Fair Housing allowlist only).
            </p>
          ) : (
            matches.map((m) => (
              <div key={m.contact.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/app/contacts/${m.contact.id}`}
                    className="font-medium hover:underline"
                  >
                    {m.contact.firstName} {m.contact.lastName}
                  </Link>
                  <Badge variant="secondary">score {m.score}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
                <form action={saveBuyerInterestAction} className="mt-2">
                  <input type="hidden" name="contactId" value={m.contact.id} />
                  <input type="hidden" name="propertyId" value={property.id} />
                  <input type="hidden" name="redirectTo" value={`/app/properties/${property.id}`} />
                  <Button type="submit" size="sm" variant="outline">
                    Save interest
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
