import Link from "next/link"
import { listOpportunities } from "@/domain/opportunities/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader, TemperatureBadge } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; temperature?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const opportunities = await listOpportunities(ctx.organization.id, {
    type: params.type as never,
    temperature: params.temperature as never,
  })

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Opportunities in your buyer and seller pipelines"
        actions={
          <>
            <Link href="/app/pipeline" className="inline-flex h-8 items-center rounded-lg border px-3 text-sm">
              Pipeline board
            </Link>
            <Link
              href="/app/leads/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
            >
              New lead
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/app/leads" className="rounded-full border px-3 py-1">
          All
        </Link>
        <Link href="/app/leads?type=BUYER" className="rounded-full border px-3 py-1">
          Buyers
        </Link>
        <Link href="/app/leads?type=SELLER" className="rounded-full border px-3 py-1">
          Sellers
        </Link>
        <Link href="/app/leads?temperature=HOT" className="rounded-full border px-3 py-1">
          Hot
        </Link>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Create an opportunity linked to a contact to start the pipeline."
          actionHref="/app/leads/new"
          actionLabel="New lead"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Next action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>
                    <Link href={`/app/contacts/${o.contactId}`} className="hover:underline">
                      {o.contact.firstName} {o.contact.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{o.type}</Badge>
                  </TableCell>
                  <TableCell>{o.pipelineStage.name}</TableCell>
                  <TableCell>
                    <TemperatureBadge value={o.temperature} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.source ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{o.nextAction ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
