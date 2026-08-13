import Link from "next/link"
import {
  getPipelines,
  listOpportunities,
  parseOpportunityFilters,
} from "@/domain/opportunities/service"
import { listSavedViews } from "@/domain/saved-views/service"
import { listOrgMembers } from "@/domain/orgs/members"
import { requireOrgContext } from "@/server/session"
import {
  EmptyState,
  NativeSelect,
  PageShell,
  SearchInput,
  StatusBadge,
  TemperatureBadge,
} from "@/components/patterns"
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
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
    <PageShell
      title="Leads"
      description="Filter, save views, and bulk-update opportunities"
      actions={
        <>
          <Link
            href="/app/settings/routing"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Routing rules
          </Link>
          <Link
            href="/app/pipeline"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Pipeline board
          </Link>
          <Link href="/app/leads/new" className={cn(buttonVariants({ size: "sm" }))}>
            New lead
          </Link>
        </>
      }
    >
      <form className="mb-4 grid gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search title/contact"
          className="h-8"
        />
        <NativeSelect name="type" defaultValue={filters.type ?? ""}>
          <option value="">All types</option>
          <option value="BUYER">BUYER</option>
          <option value="SELLER">SELLER</option>
        </NativeSelect>
        <NativeSelect name="stageKey" defaultValue={filters.stageKey ?? ""}>
          <option value="">All stages</option>
          {uniqueStages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="temperature" defaultValue={filters.temperature ?? ""}>
          <option value="">All temps</option>
          <option value="COLD">COLD</option>
          <option value="WARM">WARM</option>
          <option value="HOT">HOT</option>
        </NativeSelect>
        <input
          name="source"
          defaultValue={filters.source ?? ""}
          placeholder="Source contains…"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <NativeSelect name="assignee" defaultValue={filters.assignee ?? ""}>
          <option value="">Any assignee</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </NativeSelect>
        <input
          name="createdFrom"
          type="date"
          defaultValue={filters.createdFrom ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          name="createdTo"
          type="date"
          defaultValue={filters.createdTo ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button type="submit" className={cn(buttonVariants({ size: "sm" }), "h-8")}>
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

      <details className="mb-4 rounded-xl border bg-card p-3 text-sm shadow-[var(--shadow-card)]">
        <summary className="cursor-pointer font-medium">Save current filters as view</summary>
        <form action={createSavedViewAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="entity" value="LEADS" />
          <input type="hidden" name="filtersJson" value={JSON.stringify(filters)} />
          <input
            name="name"
            required
            placeholder="View name"
            className="h-8 min-w-[180px] flex-1 rounded-lg border border-input bg-background px-2.5"
          />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isShared" value="1" />
            Share with org
          </label>
          <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
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
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Title</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead className="hidden md:table-cell">Assignee</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
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
                    <StatusBadge tone="outline">{o.type}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge>{o.pipelineStage.name}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <TemperatureBadge value={o.temperature} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {o.assignedTo?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {o.source ?? "—"}
                  </TableCell>
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
    </PageShell>
  )
}
