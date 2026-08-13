import { createOpportunityAction } from "@/app/actions"
import { listContacts } from "@/domain/contacts/service"
import { requireOrgContext } from "@/server/session"
import { PageHeader } from "@/components/crm/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const contacts = await listContacts(ctx.organization.id)

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New lead / opportunity" description="Creates a pipeline opportunity for a contact" />
      <Card>
        <CardContent className="pt-6">
          <form action={createOpportunityAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactId">Contact</Label>
              <select
                id="contactId"
                name="contactId"
                required
                defaultValue={params.contactId ?? ""}
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
              >
                <option value="" disabled>
                  Select contact
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue="BUYER"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="BUYER">BUYER</option>
                  <option value="SELLER">SELLER</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <select
                  id="temperature"
                  name="temperature"
                  defaultValue="WARM"
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="COLD">COLD</option>
                  <option value="WARM">WARM</option>
                  <option value="HOT">HOT</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="Buyer — Wauwatosa under 400k" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedValue">Estimated value</Label>
              <Input id="estimatedValue" name="estimatedValue" type="number" min={0} step={1000} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextAction">Next action</Label>
              <Input id="nextAction" name="nextAction" placeholder="Call to schedule showing" />
            </div>
            <Button type="submit">Create lead</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
