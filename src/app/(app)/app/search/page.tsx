import Link from "next/link"
import { globalSearch } from "@/domain/search/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const results = q ? await globalSearch(ctx.organization.id, q) : []

  return (
    <div>
      <PageHeader title="Search" description="Find contacts, properties, opportunities, and tasks" />
      <form className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder='Try "Wauwatosa" or a last name'
          className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
          autoFocus
        />
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground">
          Search
        </button>
      </form>

      {!q ? (
        <EmptyState
          title="Search your CRM"
          description="Natural-language search comes later. Phase 1 uses Postgres ILIKE matching."
        />
      ) : results.length === 0 ? (
        <EmptyState title="No matches" description={`Nothing found for “${q}”.`} />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {results.map((r) => (
              <Link
                key={`${r.type}-${r.id}`}
                href={r.href}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  {r.subtitle ? (
                    <p className="truncate text-sm text-muted-foreground">{r.subtitle}</p>
                  ) : null}
                </div>
                <Badge variant="outline">{r.type}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
