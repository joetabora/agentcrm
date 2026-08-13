import { prisma } from "@/lib/db"
import type { TaskPriority, TaskStatus, Prisma } from "@/generated/prisma/client"
import { z } from "zod"

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  category: z.string().max(100).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  contactId: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>

export async function listTasks(
  organizationId: string,
  filters?: {
    status?: TaskStatus
    dueBefore?: Date
    dueAfter?: Date
    assigneeUserId?: string
  },
) {
  const where: Prisma.TaskWhereInput = { organizationId }
  if (filters?.status) where.status = filters.status
  if (filters?.assigneeUserId) where.assigneeUserId = filters.assigneeUserId
  if (filters?.dueBefore || filters?.dueAfter) {
    where.dueAt = {}
    if (filters.dueBefore) where.dueAt.lte = filters.dueBefore
    if (filters.dueAfter) where.dueAt.gte = filters.dueAfter
  }

  return prisma.task.findMany({
    where,
    include: {
      contact: true,
      property: true,
      opportunity: true,
      assignee: true,
    },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
  })
}

export async function createTask(
  organizationId: string,
  actorUserId: string,
  input: CreateTaskInput,
) {
  const data = createTaskSchema.parse(input)

  const task = await prisma.task.create({
    data: {
      organizationId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority as TaskPriority,
      category: data.category ?? null,
      dueAt: data.dueAt ?? null,
      contactId: data.contactId ?? null,
      opportunityId: data.opportunityId ?? null,
      propertyId: data.propertyId ?? null,
      assigneeUserId: actorUserId,
    },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: data.contactId ?? null,
      opportunityId: data.opportunityId ?? null,
      propertyId: data.propertyId ?? null,
      actorUserId,
      type: "TASK",
      subject: "Task created",
      body: task.title,
    },
  })

  return task
}

export async function completeTask(
  organizationId: string,
  actorUserId: string,
  taskId: string,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId },
  })
  if (!task) return null

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: "COMPLETED", completedAt: new Date() },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: task.contactId,
      opportunityId: task.opportunityId,
      propertyId: task.propertyId,
      actorUserId,
      type: "TASK",
      subject: "Task completed",
      body: task.title,
    },
  })

  return updated
}

export const createAppointmentSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  contactId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
})

export async function listAppointments(
  organizationId: string,
  filters?: { from?: Date; to?: Date },
) {
  const where: Prisma.AppointmentWhereInput = {
    organizationId,
    status: "SCHEDULED",
  }
  if (filters?.from || filters?.to) {
    where.startsAt = {}
    if (filters.from) where.startsAt.gte = filters.from
    if (filters.to) where.startsAt.lte = filters.to
  }

  return prisma.appointment.findMany({
    where,
    include: { contact: true, property: true, owner: true },
    orderBy: { startsAt: "asc" },
  })
}

export async function createAppointment(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof createAppointmentSchema>,
) {
  const data = createAppointmentSchema.parse(input)

  const appointment = await prisma.appointment.create({
    data: {
      organizationId,
      title: data.title,
      description: data.description ?? null,
      location: data.location ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      contactId: data.contactId ?? null,
      propertyId: data.propertyId ?? null,
      ownerUserId: actorUserId,
    },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: data.contactId ?? null,
      propertyId: data.propertyId ?? null,
      actorUserId,
      type: "APPOINTMENT",
      subject: "Appointment scheduled",
      body: appointment.title,
      occurredAt: appointment.startsAt,
    },
  })

  return appointment
}
