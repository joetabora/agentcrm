import Link from "next/link"
import { moveStageAction, updatePipelineStageAction } from "@/app/actions"
import {
  getPipelines,
  listOpportunities,
  parseOpportunityFilters,
} from "@/domain/opportunities/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader, TemperatureBadge } from "@/components/crm/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const type = (params.type === "SELLER" ? "SELLER" : "BUYER") as "BUYER" | "SELLER"
  const configure = params.configure === "1" || params.configure === "true"
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

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Kanban view — stage moves are audited"
        actions={
          <>
            <Link
              href={`/app/pipeline?${typeQs}${configure ? "" : "&configure=1"}`}
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
            >
              {configure ? "Hide stage config" : "Configure stages"}
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

      <div className="mb-4 flex flex-wrap gap-2">
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
          href={`/app/pipeline?type=${type}&temperature=HOT`}
          className="rounded-full border px-3 py-1 text-sm"
        >
          Hot only
        </Link>
        <Link
          href={`/app/pipeline?type=${type}&assignee=me`}
          className="rounded-full border px-3 py-1 text-sm"
        >
          Mine
        </Link>
        <Link href={`/app/pipeline?type=${type}`} className="rounded-full border px-3 py-1 text-sm">
          Clear filters
        </Link>
      </div>

      {configure && pipeline ? (
        <div className="mb-4 space-y-2 rounded-lg border p-3">
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
                className="h-8 min-w-[140px] rounded-md border bg-background px-2"
              />
              <input
                name="position"
                type="number"
                defaultValue={stage.position}
                className="h-8 w-20 rounded-md border bg-background px-2"
              />
              <button type="submit" className="h-8 rounded-md border px-2 text-xs">
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
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipeline.stages.map((stage) => {
            const items = byStage.get(stage.id) ?? []
            return (
              <div key={stage.id} className="w-72 shrink-0">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{stage.name}</span>
                      <span className="text-muted-foreground">{items.length}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.length === 0 ? (
                      <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        No leads in this stage
                      </p>
                    ) : (
                      items.map((o) => (
                        <div key={o.id} className="rounded-md border bg-background p-2 text-sm">
                          <Link
                            href={`/app/leads/${o.id}`}
                            className="font-medium hover:underline"
                          >
                            {o.title}
                          </Link>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-muted-foreground">
                              {o.contact.firstName} {o.contact.lastName}
                              {o.assignedTo ? ` · ${o.assignedTo.name}` : ""}
                            </span>
                            <TemperatureBadge value={o.temperature} />
                          </div>
                          <form action={moveStageAction} className="mt-2">
                            <input type="hidden" name="opportunityId" value={o.id} />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value={`/app/pipeline?type=${type}`}
                            />
                            <select
                              name="pipelineStageId"
                              defaultValue={stage.id}
                              className="h-7 w-full rounded border bg-background px-1 text-xs"
                            >
                              {pipeline.stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Move to {s.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="mt-1 w-full rounded border px-2 py-1 text-xs hover:bg-muted"
                            >
                              Update stage
                            </button>
                          </form>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
