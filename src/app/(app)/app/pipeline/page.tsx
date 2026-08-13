import Link from "next/link"
import { moveStageAction, updatePipelineStageAction } from "@/app/actions"
import {
  getPipelines,
  listOpportunities,
  parseOpportunityFilters,
} from "@/domain/opportunities/service"
import { requireOrgContext } from "@/server/session"
import {
  EmptyState,
  NativeSelect,
  PageShell,
  StatusBadge,
  TemperatureBadge,
} from "@/components/patterns"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatBudget(value: unknown) {
  if (value == null) return undefined
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const type = (params.type === "SELLER" ? "SELLER" : "BUYER") as "BUYER" | "SELLER"
  const configure = params.configure === "1" || params.configure === "true"
  const view = params.view === "list" ? "list" : "kanban"
  const filters = parseOpportunityFilters(params)

  const pipelines = await getPipelines(ctx.organization.id)
  const pipeline =
    pipelines.find((p) => p.type === type && p.isDefault) ??
    pipelines.find((p) => p.type === type)

  const opportunities = await listOpportunities(
    ctx.organization.id,
    {
      ...filters,
      type,
      pipelineId: pipeline?.id,
    },
    ctx.user.id,
  )

  const byStage = new Map<string, typeof opportunities>()
  for (const stage of pipeline?.stages ?? []) {
    byStage.set(stage.id, [])
  }
  for (const opp of opportunities) {
    const list = byStage.get(opp.pipelineStageId) ?? []
    list.push(opp)
    byStage.set(opp.pipelineStageId, list)
  }

  const typeQs = `type=${type}`
  const viewBase = `/app/pipeline?${typeQs}`

  function stageMoveForm(opportunityId: string, currentStageId: string) {
    if (!pipeline) return null
    return (
      <form action={moveStageAction} className="mt-2 space-y-1">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input
          type="hidden"
          name="redirectTo"
          value={`/app/pipeline?type=${type}${view === "list" ? "&view=list" : ""}`}
        />
        <NativeSelect name="pipelineStageId" defaultValue={currentStageId} className="h-7 text-xs">
          {pipeline.stages.map((s) => (
            <option key={s.id} value={s.id}>
              Move to {s.name}
            </option>
          ))}
        </NativeSelect>
        <button
          type="submit"
          className="w-full rounded-md border px-2 py-1 text-xs hover:bg-muted"
        >
          Update stage
        </button>
      </form>
    )
  }

  return (
    <PageShell
      title="Pipeline"
      description="Kanban and list views — stage moves are audited"
      actions={
        <>
          <Link
            href={`${viewBase}${configure ? "" : "&configure=1"}${view === "list" ? "&view=list" : ""}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {configure ? "Hide stage config" : "Configure stages"}
          </Link>
          <Link href="/app/leads/new" className={cn(buttonVariants({ size: "sm" }))}>
            New lead
          </Link>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-2 flex gap-1 rounded-lg border p-0.5">
          <Link
            href={viewBase}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium",
              view === "kanban"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Kanban
          </Link>
          <Link
            href={`${viewBase}&view=list`}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            List
          </Link>
        </div>
        <Link
          href="/app/pipeline?type=BUYER"
          className={`rounded-full border px-3 py-1 text-sm ${type === "BUYER" ? "bg-primary text-primary-foreground" : ""}`}
        >
          Buyers
        </Link>
        <Link
          href="/app/pipeline?type=SELLER"
          className={`rounded-full border px-3 py-1 text-sm ${type === "SELLER" ? "bg-primary text-primary-foreground" : ""}`}
        >
          Sellers
        </Link>
        <Link
          href={`/app/pipeline?type=${type}&temperature=HOT${view === "list" ? "&view=list" : ""}`}
          className="rounded-full border px-3 py-1 text-sm"
        >
          Hot only
        </Link>
        <Link
          href={`/app/pipeline?type=${type}&assignee=me${view === "list" ? "&view=list" : ""}`}
          className="rounded-full border px-3 py-1 text-sm"
        >
          Mine
        </Link>
        <Link
          href={`/app/pipeline?type=${type}${view === "list" ? "&view=list" : ""}`}
          className="rounded-full border px-3 py-1 text-sm"
        >
          Clear filters
        </Link>
      </div>

      {configure && pipeline ? (
        <div className="mb-4 space-y-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
          <p className="text-sm font-medium">Rename / reorder stages</p>
          {pipeline.stages.map((stage) => (
            <form
              key={stage.id}
              action={updatePipelineStageAction}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <input type="hidden" name="stageId" value={stage.id} />
              <input type="hidden" name="pipelineType" value={type} />
              <input
                name="name"
                defaultValue={stage.name}
                className="h-8 min-w-[140px] rounded-lg border border-input bg-background px-2"
              />
              <input
                name="position"
                type="number"
                defaultValue={stage.position}
                className="h-8 w-20 rounded-lg border border-input bg-background px-2"
              />
              <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Save
              </button>
              <span className="text-xs text-muted-foreground">key: {stage.key}</span>
            </form>
          ))}
        </div>
      ) : null}

      {!pipeline ? (
        <EmptyState
          title="No pipeline"
          description="Default pipelines are created with your organization."
        />
      ) : view === "list" ? (
        <div className="space-y-6">
          {pipeline.stages.map((stage) => {
            const items = byStage.get(stage.id) ?? []
            return (
              <section key={stage.id}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {stage.name}
                  </h2>
                  <StatusBadge tone="outline">{items.length}</StatusBadge>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    No leads in this stage
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((o) => (
                      <li
                        key={o.id}
                        className="rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/app/leads/${o.id}`}
                              className="text-sm font-medium hover:underline"
                            >
                              {o.title}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {o.contact.firstName} {o.contact.lastName}
                              {o.assignedTo ? ` · ${o.assignedTo.name}` : ""}
                            </p>
                          </div>
                          <TemperatureBadge value={o.temperature} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone="outline">{o.type}</StatusBadge>
                          {o.leadScore != null ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              Score {o.leadScore}
                            </span>
                          ) : null}
                          {formatBudget(o.estimatedValue) ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {formatBudget(o.estimatedValue)}
                            </span>
                          ) : null}
                        </div>
                        {o.nextAction ? (
                          <p className="mt-2 truncate text-xs text-muted-foreground">
                            Next: {o.nextAction}
                          </p>
                        ) : null}
                        {stageMoveForm(o.id, stage.id)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-4 md:flex-row md:overflow-x-auto">
          {pipeline.stages.map((stage) => {
            const items = byStage.get(stage.id) ?? []
            return (
              <div key={stage.id} className="w-full shrink-0 md:w-72">
                <div className="h-full rounded-xl border bg-muted/30 p-3 shadow-[var(--shadow-card)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium text-foreground">{stage.name}</h2>
                    <StatusBadge tone="outline">{items.length}</StatusBadge>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="rounded-lg border border-dashed bg-card/50 p-3 text-xs text-muted-foreground">
                        No leads in this stage
                      </p>
                    ) : (
                      items.map((o) => (
                        <div
                          key={o.id}
                          className="rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link
                                href={`/app/leads/${o.id}`}
                                className="truncate text-sm font-medium hover:underline"
                              >
                                {o.title}
                              </Link>
                              <p className="truncate text-xs text-muted-foreground">
                                {o.contact.firstName} {o.contact.lastName}
                              </p>
                            </div>
                            <TemperatureBadge value={o.temperature} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <StatusBadge tone="outline">{o.type}</StatusBadge>
                            {o.leadScore != null ? (
                              <span className="text-xs tabular-nums text-muted-foreground">
                                Score {o.leadScore}
                              </span>
                            ) : null}
                            {formatBudget(o.estimatedValue) ? (
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {formatBudget(o.estimatedValue)}
                              </span>
                            ) : null}
                          </div>
                          {o.nextAction ? (
                            <p className="mt-2 truncate text-xs text-muted-foreground">
                              Next: {o.nextAction}
                            </p>
                          ) : null}
                          {o.assignedTo ? (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {o.assignedTo.name}
                            </p>
                          ) : null}
                          {stageMoveForm(o.id, stage.id)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
