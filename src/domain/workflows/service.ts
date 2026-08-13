import { prisma } from "@/lib/db"
import type { Prisma, WorkflowStatus } from "@/generated/prisma/client"
import { z } from "zod"
import {
  parseWorkflowDefinition,
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "@/domain/workflows/definition"
import { processDueEnrollments } from "@/domain/workflows/engine"

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT"),
  definition: workflowDefinitionSchema,
})

export type CreateWorkflowInput = z.input<typeof createWorkflowSchema>

export async function listWorkflows(organizationId: string) {
  return prisma.workflow.findMany({
    where: { organizationId },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      _count: { select: { enrollments: true } },
    },
  })
}

export async function getWorkflow(organizationId: string, workflowId: string) {
  return prisma.workflow.findFirst({
    where: { id: workflowId, organizationId },
  })
}

export async function createWorkflow(organizationId: string, input: CreateWorkflowInput) {
  const data = createWorkflowSchema.parse(input)
  parseWorkflowDefinition(data.definition)
  return prisma.workflow.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description ?? null,
      status: data.status as WorkflowStatus,
      definition: data.definition as Prisma.InputJsonValue,
    },
  })
}

export async function updateWorkflowStatus(
  organizationId: string,
  workflowId: string,
  status: WorkflowStatus,
) {
  const existing = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId },
  })
  if (!existing) return null
  return prisma.workflow.update({
    where: { id: workflowId },
    data: { status },
  })
}

export async function deleteWorkflow(organizationId: string, workflowId: string) {
  const existing = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId },
  })
  if (!existing) return null
  await prisma.workflow.delete({ where: { id: workflowId } })
  return existing
}

export async function listEnrollments(
  organizationId: string,
  filters?: { workflowId?: string; take?: number },
) {
  return prisma.workflowEnrollment.findMany({
    where: {
      organizationId,
      ...(filters?.workflowId ? { workflowId: filters.workflowId } : {}),
    },
    include: {
      workflow: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      opportunity: { select: { id: true, title: true } },
    },
    orderBy: { enrolledAt: "desc" },
    take: filters?.take ?? 50,
  })
}

export async function listActiveWorkflowsForManual(organizationId: string) {
  const workflows = await prisma.workflow.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  })
  return workflows.filter((w) => {
    try {
      const def = parseWorkflowDefinition(w.definition)
      return def.trigger === "MANUAL"
    } catch {
      return false
    }
  })
}

export function getDefinition(workflow: { definition: unknown }): WorkflowDefinition {
  return parseWorkflowDefinition(workflow.definition)
}

/** Dev-friendly: resume due enrollments when visiting settings. */
export async function tickWorkflowsForOrg(organizationId: string) {
  return processDueEnrollments(organizationId)
}
