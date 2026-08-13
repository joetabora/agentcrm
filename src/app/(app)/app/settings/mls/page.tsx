import Link from "next/link"
import { requireOrgContext } from "@/server/session"
import { getMlsProvider, hasResoCredentials } from "@/providers/mls"
import { importMlsJsonAction, syncMlsAction } from "@/app/actions"
import { PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function MlsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; imported?: string; error?: string }>
}) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const provider = getMlsProvider()
  const live = hasResoCredentials()

  return (
    <div className="space-y-6">
      <PageHeader
        title="MLS / IDX"
        description="Authorized RESO/IDX/VOW feeds only. No scraping. Fixtures are labeled and are not a live MLS."
      />

      {sp.synced ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Sync completed.</p>
      ) : null}
      {sp.imported ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Imported {sp.imported} listing(s).
        </p>
      ) : null}
      {sp.error ? (
        <p className="text-sm text-destructive">Import/sync error: {sp.error}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>Provider:</span>
            <Badge variant="outline">{provider.name}</Badge>
            <Badge variant={live ? "secondary" : "outline"}>
              {live ? "RESO credentials detected" : "Fixture mode (no RESO env)"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Set <code className="text-xs">MLS_RESO_BASE_URL</code> plus access token or
            client-credentials to enable live RESO. Brokerage + MLS agreements required.
          </p>
          <p>
            <Link href="/app/properties" className="text-primary underline-offset-2 hover:underline">
              View properties
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sync from provider ({live ? "RESO" : "fixtures"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={syncMlsAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mlsNumber">MLS # / listing key (optional)</Label>
              <Input id="mlsNumber" name="mlsNumber" placeholder="FIX-1001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code (optional)</Label>
              <Input id="postalCode" name="postalCode" placeholder="53202" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">
                {live ? "Sync RESO search" : "Import matching fixtures"}
              </Button>
            </div>
          </form>
          {!live ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Leave filters empty to upsert all three WI mock fixtures. Attribution will read
              “Mock fixture — not a live MLS feed”.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual RESO-shaped JSON import</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={importMlsJsonAction} className="space-y-3">
            <Label htmlFor="json">JSON (object, array, or OData {"{ value: [] }"})</Label>
            <textarea
              id="json"
              name="json"
              rows={10}
              required
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              placeholder={`{\n  "ListingKey": "ABC-1",\n  "ListingId": "123",\n  "UnparsedAddress": "123 Main St",\n  "City": "Milwaukee",\n  "StateOrProvince": "WI",\n  "PostalCode": "53202",\n  "ListPrice": 400000,\n  "StandardStatus": "Active"\n}`}
            />
            <Button type="submit">Import</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Only import data you are authorized to store. Incomplete address or missing listing
            key/number is rejected.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Org: {ctx.organization.name}</p>
    </div>
  )
}
