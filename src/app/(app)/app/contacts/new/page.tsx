import { createContactAction } from "@/app/actions"
import { PageHeader } from "@/components/crm/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New contact" description="Add a person to your organization CRM" />
      <Card>
        <CardContent className="pt-6">
          <form action={createContactAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredName">Preferred name</Label>
              <Input id="preferredName" name="preferredName" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactType">Type</Label>
                <select
                  id="contactType"
                  name="contactType"
                  defaultValue="LEAD"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  {[
                    "LEAD",
                    "BUYER",
                    "SELLER",
                    "PAST_CLIENT",
                    "SPHERE",
                    "VENDOR",
                    "AGENT",
                    "LENDER",
                    "ATTORNEY",
                    "TITLE",
                    "INVESTOR",
                    "OTHER",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <select
                  id="temperature"
                  name="temperature"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="COLD">COLD</option>
                  <option value="WARM">WARM</option>
                  <option value="HOT">HOT</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" placeholder="Zillow, referral, open house…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notesSummary">Notes</Label>
              <textarea
                id="notesSummary"
                name="notesSummary"
                rows={4}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit">Save contact</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
