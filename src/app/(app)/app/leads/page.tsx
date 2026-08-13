import Link from "next/link"
import {
  getPipelines,
  listOpportunities,
  parseOpportunityFilters,
} from "@/domain/opportunities/service"
import { listSavedViews } from "@/domain/saved-views/service"
import { listOrgMembers } from "@/domain/orgs/members"
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
import { LeadsBulkBar } from "@/components/crm/leads-bulk-bar"
import { createSavedViewAction, deleteSavedViewAction } from "@/app/actions"

function buildHref(base: Record<string, string | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(base)) {
    if (v) sp.set(k, v)
  }
  const q = sp.toString()
  return q ? `/app/leads?${q}` : "/app/leads"
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const filters = parseOpportunityFilters(params)
  const viewId = typeof params.view === "string" ? params.view : undefined

  const [pipelines, members, savedViews, opportunities] = await Promise.all([
    getPipelines(ctx.organization.id),
    listOrgMembers(ctx.organization.id),
    listSavedViews(ctx.organization.id, ctx.user.id, "LEADS"),
    listOpportunities(ctx.organization.id, filters, ctx.user.id),
  ])

  const stages = pipelines.flatMap((p) => p.stages)
  const uniqueStages = Array.from(new Map(stages.map((s) => [s.key, s])).values())

  const currentQuery = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && String(v).length) currentQuery.set(k, String(v))
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Filter, save views, and bulk-update opportunities"
        actions={
          <>
            <Link
              href="/app/settings/routing"
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
            >
              Routing rules
            </Link>
            <Link
              href="/app/pipeline"
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
            >
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

      <form className="mb-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search title/contact"
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
        <select
          name="type"
          defaultValue={filters.type ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All types</option>
          <option value="BUYER">BUYER</option>
          <option value="SELLER">SELLER</option>
        </select>
        <select
          name="stageKey"
          defaultValue={filters.stageKey ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All stages</option>
          {uniqueStages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="temperature"
          defaultValue={filters.temperature ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All temps</option>
          <option value="COLD">COLD</option>
          <option value="WARM">WARM</option>
          <option value="HOT">HOT</option>
        </select>
        <input
          name="source"
          defaultValue={filters.source ?? ""}
          placeholder="Source contains…"
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
        <select
          name="assignee"
          defaultValue={filters.assignee ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Any assignee</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>
        <input
          name="createdFrom"
          type="date"
          defaultValue={filters.createdFrom ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
        <input
          name="createdTo"
          type="date"
          defaultValue={filters.createdTo ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="uncontacted"
            value="1"
            defaultChecked={filters.uncontacted === true || filters.uncontacted === "1"}
          />
          Uncontacted
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="openOnly"
            value="1"
            defaultChecked={filters.openOnly === true || filters.openOnly === "1"}
          />
          Open only
        </label>
        <input
          name="inactiveDays"
          type="number"
          min={1}
          placeholder="Inactive days"
          defaultValue={filters.inactiveDays ?? ""}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        />
        <button type="submit" className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground">
          Apply filters
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/app/leads" className="rounded-full border px-3 py-1">
          Clear
        </Link>
        <Link
          href={buildHref({ type: "BUYER", openOnly: "1" })}
          className="rounded-full border px-3 py-1"
        >
          Open buyers
        </Link>
        <Link
          href={buildHref({ temperature: "HOT", openOnly: "1" })}
          className="rounded-full border px-3 py-1"
        >
          Hot + open
        </Link>
        <Link href={buildHref({ uncontacted: "1" })} className="rounded-full border px-3 py-1">
          Uncontacted
        </Link>
        <Link href={buildHref({ assignee: "me" })} className="rounded-full border px-3 py-1">
          Mine
        </Link>
        {savedViews.map((v) => {
          const f = (v.filters ?? {}) as Record<string, string>
          const href = buildHref({ ...f, view: v.id })
          return (
            <Link
              key={v.id}
              href={href}
              className={`rounded-full border px-3 py-1 ${viewId === v.id ? "bg-primary text-primary-foreground" : ""}`}
            >
              {v.name}
              {v.isShared ? " · shared" : ""}
            </Link>
          )
        })}
      </div>

      <details className="mb-4 rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Save current filters as view</summary>
        <form action={createSavedViewAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="entity" value="LEADS" />
          <input type="hidden" name="filtersJson" value={JSON.stringify(filters)} />
          <input
            name="name"
            required
            placeholder="View name"
            className="h-8 min-w-[180px] flex-1 rounded-md border bg-background px-2"
          />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isShared" value="1" />
            Share with org
          </label>
          <button type="submit" className="h-8 rounded-md border px-3">
            Save view
          </button>
        </form>
        {savedViews.filter((v) => v.ownerUserId === ctx.user.id).length > 0 ? (
          <ul className="mt-3 space-y-1 text-muted-foreground">
            {savedViews
              .filter((v) => v.ownerUserId === ctx.user.id)
              .map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span>{v.name}</span>
                  <form action={deleteSavedViewAction}>
                    <input type="hidden" name="viewId" value={v.id} />
                    <button type="submit" className="text-xs text-destructive hover:underline">
                      Delete
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        ) : null}
      </details>

      <LeadsBulkBar
        members={members.map((m) => ({ userId: m.userId, name: m.user.name }))}
        stages={stages.map((s) => ({ id: s.id, name: `${s.name}` }))}
      />

      {opportunities.length === 0 ? (
        <EmptyState
          title="No leads match"
          description="Adjust filters or create a new opportunity."
          actionHref="/app/leads/new"
          actionLabel="New lead"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Title</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <input type="checkbox" name="opportunityId" value={o.id} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/app/leads/${o.id}`} className="font-medium hover:underline">
                      {o.title}
                    </Link>
                  </TableCell>
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
                  <TableCell className="text-muted-foreground">
                    {o.assignedTo?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.source ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {currentQuery.toString() ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Shareable filter URL query: ?{currentQuery.toString()}
        </p>
      ) : null}
    </div>
  )
}
