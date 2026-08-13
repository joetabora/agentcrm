import { createPropertyAction } from "@/app/actions"
import { listContacts } from "@/domain/contacts/service"
import { requireOrgContext } from "@/server/session"
import { PageHeader } from "@/components/crm/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function NewPropertyPage() {
  const ctx = await requireOrgContext()
  const contacts = await listContacts(ctx.organization.id)

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New property" description="User-entered property — not MLS data" />
      <Card>
        <CardContent className="pt-6">
          <form action={createPropertyAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="line1">Street address</Label>
              <Input id="line1" name="line1" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line2">Unit / line 2</Label>
              <Input id="line2" name="line2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" required defaultValue="WI" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">ZIP</Label>
                <Input id="postalCode" name="postalCode" required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="beds">Beds</Label>
                <Input id="beds" name="beds" type="number" step="0.5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baths">Baths</Label>
                <Input id="baths" name="baths" type="number" step="0.5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sqft">Sqft</Label>
                <Input id="sqft" name="sqft" type="number" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="listPrice">List price</Label>
                <Input id="listPrice" name="listPrice" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue="UNKNOWN"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  {[
                    "UNKNOWN",
                    "PRE_LISTING",
                    "ACTIVE",
                    "PENDING",
                    "SOLD",
                    "EXPIRED",
                    "WITHDRAWN",
                    "CANCELLED",
                    "OFF_MARKET",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactId">Linked contact (optional)</Label>
              <select
                id="contactId"
                name="contactId"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">None</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit">Save property</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
