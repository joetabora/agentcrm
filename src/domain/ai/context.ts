import { prisma } from "@/lib/db"
import { globalSearch } from "@/domain/search/service"
import { safeParseBuyerPreferences } from "@/domain/properties/preferences"

export type ContextSource = {
  type: "contact" | "opportunity" | "property" | "task" | "activity" | "fact" | "search"
  id: string
  label: string
}

export type CrmContextPack = {
  text: string
  sources: ContextSource[]
  empty: boolean
}

function line(parts: string[]) {
  return parts.filter(Boolean).join(" | ")
}

export async function buildCrmContext(input: {
  organizationId: string
  contactId?: string | null
  opportunityId?: string | null
  q?: string | null
}): Promise<CrmContextPack> {
  const sources: ContextSource[] = []
  const blocks: string[] = []
  const orgId = input.organizationId

  if (input.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, organizationId: orgId },
      include: {
        emails: true,
        phones: true,
        facts: { orderBy: { createdAt: "desc" }, take: 20 },
        opportunities: {
          include: { pipelineStage: true },
          orderBy: { updatedAt: "desc" },
          take: 10,
        },
        tasks: {
          where: { status: "OPEN" },
          orderBy: { dueAt: "asc" },
          take: 15,
        },
        activities: {
          orderBy: { occurredAt: "desc" },
          take: 20,
        },
        properties: {
          include: { property: true },
          take: 15,
        },
      },
    })

    if (!contact) {
      return { text: "", sources: [], empty: true }
    }

    sources.push({
      type: "contact",
      id: contact.id,
      label: `${contact.firstName} ${contact.lastName}`,
    })
    const email = contact.emails.find((e) => e.isPrimary)?.email ?? contact.emails[0]?.email
    const phone = contact.phones.find((p) => p.isPrimary)?.phone ?? contact.phones[0]?.phone
    const prefs = safeParseBuyerPreferences(contact.preferences)
    blocks.push(
      [
        `CONTACT id=${contact.id}`,
        `name=${contact.firstName} ${contact.lastName}`,
        `type=${contact.contactType}`,
        `lifecycle=${contact.lifecycleStage}`,
        `temperature=${contact.temperature ?? "null"}`,
        `source=${contact.source ?? "null"}`,
        `email=${email ?? "null"}`,
        `phone=${phone ?? "null"}`,
        `doNotContact=${contact.doNotContact}`,
        `consentEmail=${contact.consentEmail} consentSms=${contact.consentSms}`,
        `budgetMin=${contact.budgetMin ?? "null"} budgetMax=${contact.budgetMax ?? "null"}`,
        `preferences=${prefs.success ? JSON.stringify(prefs.data) : "{}"}`,
        `notesSummary=${contact.notesSummary ?? "null"}`,
        `motivation=${contact.motivation ?? "null"}`,
        `timeline=${contact.timeline ?? "null"}`,
      ].join("\n"),
    )

    for (const f of contact.facts) {
      sources.push({ type: "fact", id: f.id, label: f.statement.slice(0, 80) })
      blocks.push(
        `FACT id=${f.id} source=${f.source} confidence=${f.confidence} provenance=${f.provenance}: ${f.statement}`,
      )
    }

    for (const o of contact.opportunities) {
      sources.push({ type: "opportunity", id: o.id, label: o.title })
      blocks.push(
        line([
          `OPPORTUNITY id=${o.id}`,
          `title=${o.title}`,
          `type=${o.type}`,
          `stage=${o.pipelineStage.name}`,
          `temp=${o.temperature}`,
          `source=${o.source ?? "null"}`,
          `nextAction=${o.nextAction ?? "null"}`,
          `estimatedValue=${o.estimatedValue ?? "null"}`,
        ]),
      )
    }

    for (const t of contact.tasks) {
      sources.push({ type: "task", id: t.id, label: t.title })
      blocks.push(
        line([
          `TASK id=${t.id}`,
          `title=${t.title}`,
          `priority=${t.priority}`,
          `dueAt=${t.dueAt?.toISOString() ?? "null"}`,
          `status=${t.status}`,
        ]),
      )
    }

    for (const a of contact.activities) {
      sources.push({ type: "activity", id: a.id, label: a.subject ?? a.type })
      blocks.push(
        line([
          `ACTIVITY id=${a.id}`,
          `type=${a.type}`,
          `subject=${a.subject ?? ""}`,
          `body=${(a.body ?? "").slice(0, 200)}`,
          `at=${a.occurredAt.toISOString()}`,
        ]),
      )
    }

    for (const cp of contact.properties) {
      const p = cp.property
      sources.push({ type: "property", id: p.id, label: p.line1 })
      blocks.push(
        line([
          `PROPERTY id=${p.id}`,
          `role=${cp.role}`,
          `address=${p.line1}, ${p.city} ${p.postalCode}`,
          `beds=${p.beds ?? "null"} baths=${p.baths ?? "null"}`,
          `listPrice=${p.listPrice ?? "null"}`,
          `status=${p.status}`,
          `provenance=${p.provenance}`,
        ]),
      )
    }
  }

  if (input.opportunityId) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: input.opportunityId, organizationId: orgId },
      include: {
        contact: true,
        pipelineStage: true,
        property: true,
        tasks: { where: { status: "OPEN" }, take: 10 },
      },
    })
    if (!opp) {
      if (blocks.length === 0) {
        return { text: "", sources: [], empty: true }
      }
    } else {
      sources.push({ type: "opportunity", id: opp.id, label: opp.title })
      blocks.push(
        line([
          `OPPORTUNITY id=${opp.id}`,
          `title=${opp.title}`,
          `contactId=${opp.contactId}`,
          `contact=${opp.contact.firstName} ${opp.contact.lastName}`,
          `stage=${opp.pipelineStage.name}`,
          `type=${opp.type}`,
          `temp=${opp.temperature}`,
        ]),
      )
      if (opp.property) {
        sources.push({
          type: "property",
          id: opp.property.id,
          label: opp.property.line1,
        })
      }
    }
  }

  const q = input.q?.trim()
  if (q) {
    const hits = await globalSearch(orgId, q, 8)
    for (const h of hits) {
      sources.push({
        type: h.type === "opportunity" ? "opportunity" : h.type === "property" ? "property" : h.type === "task" ? "task" : "contact",
        id: h.id,
        label: h.title,
      })
      blocks.push(`SEARCH_HIT type=${h.type} id=${h.id} title=${h.title} subtitle=${h.subtitle ?? ""}`)
    }

    // If no contact pinned, enrich top contact hit
    if (!input.contactId) {
      const topContact = hits.find((h) => h.type === "contact")
      if (topContact) {
        const nested = await buildCrmContext({
          organizationId: orgId,
          contactId: topContact.id,
        })
        if (!nested.empty) {
          blocks.push("--- Expanded top search contact ---")
          blocks.push(nested.text)
          for (const s of nested.sources) {
            if (!sources.some((x) => x.id === s.id && x.type === s.type)) sources.push(s)
          }
        }
      }
    }
  }

  // Org snapshot when still empty: light open-pipeline counts (not fabricated narratives)
  if (blocks.length === 0) {
    const [openTasks, openOpps, propCount] = await Promise.all([
      prisma.task.count({ where: { organizationId: orgId, status: "OPEN" } }),
      prisma.opportunity.count({
        where: { organizationId: orgId, pipelineStage: { isTerminal: false } },
      }),
      prisma.property.count({ where: { organizationId: orgId } }),
    ])
    if (openTasks + openOpps + propCount === 0) {
      return { text: "", sources: [], empty: true }
    }
    blocks.push(
      `ORG_SNAPSHOT openTasks=${openTasks} openOpportunities=${openOpps} properties=${propCount}`,
    )
    sources.push({
      type: "search",
      id: orgId,
      label: "Organization snapshot",
    })
  }

  const text = blocks.join("\n")
  return {
    text,
    sources,
    empty: text.trim().length === 0,
  }
}
