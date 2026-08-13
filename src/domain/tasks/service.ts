import { prisma } from "@/lib/db"
import { writeAuditLog } from "@/server/audit"
import type {
  TaskPriority,
  TaskRecurrenceRule,
  TaskStatus,
  Prisma,
} from "@/generated/prisma/client"
import { z } from "zod"
import { addDays, addHours, addMonths, addWeeks, nextMonday, setHours, setMinutes, setSeconds } from "date-fns"

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  category: z.string().max(100).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  contactId: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  recurrenceRule: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
})

export type CreateTaskInput = z.input<typeof createTaskSchema>

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.string().max(100).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  recurrenceRule: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
})

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

export type TaskListFilter =
  | "open"
  | "snoozed"
  | "overdue"
  | "completed"
  | "cancelled"

const taskInclude = {
  contact: true,
  property: true,
  opportunity: {
    include: { pipelineStage: true },
  },
  assignee: true,
} satisfies Prisma.TaskInclude

export async function unsnoozeDueTasks(organizationId: string) {
  const now = new Date()
  const due = await prisma.task.findMany({
    where: {
      organizationId,
      status: "SNOOZED",
      snoozedUntil: { lte: now },
    },
    select: { id: true },
  })
  if (due.length === 0) return 0
  await prisma.task.updateMany({
    where: { id: { in: due.map((t) => t.id) }, organizationId },
    data: { status: "OPEN", snoozedUntil: null },
  })
  return due.length
}

export async function listTasks(
  organizationId: string,
  filters?: {
    status?: TaskStatus
    filter?: TaskListFilter
    dueBefore?: Date
    dueAfter?: Date
    assigneeUserId?: string
  },
) {
  await unsnoozeDueTasks(organizationId)

  const where: Prisma.TaskWhereInput = { organizationId }
  const now = new Date()

  if (filters?.assigneeUserId) where.assigneeUserId = filters.assigneeUserId

  if (filters?.filter === "open") {
    where.status = "OPEN"
  } else if (filters?.filter === "snoozed") {
    where.status = "SNOOZED"
  } else if (filters?.filter === "overdue") {
    where.status = "OPEN"
    where.dueAt = { lt: now }
  } else if (filters?.filter === "completed") {
    where.status = "COMPLETED"
  } else if (filters?.filter === "cancelled") {
    where.status = "CANCELLED"
  } else if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.dueBefore || filters?.dueAfter) {
    const dueAt: Prisma.DateTimeNullableFilter = {
      ...(typeof where.dueAt === "object" && where.dueAt !== null && !("getTime" in where.dueAt)
        ? (where.dueAt as Prisma.DateTimeNullableFilter)
        : {}),
    }
    if (filters.dueBefore) dueAt.lte = filters.dueBefore
    if (filters.dueAfter) dueAt.gte = filters.dueAfter
    where.dueAt = dueAt
  }

  return prisma.task.findMany({
    where,
    include: taskInclude,
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
      recurrenceRule: data.recurrenceRule as TaskRecurrenceRule,
    },
    include: taskInclude,
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

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Task",
    entityId: task.id,
    action: "CREATE",
    after: { title: task.title, dueAt: task.dueAt, priority: task.priority },
  })

  return task
}

export async function updateTask(
  organizationId: string,
  actorUserId: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId },
  })
  if (!task) return null

  const data = updateTaskSchema.parse(input)
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priority !== undefined ? { priority: data.priority as TaskPriority } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
      ...(data.recurrenceRule !== undefined
        ? { recurrenceRule: data.recurrenceRule as TaskRecurrenceRule }
        : {}),
    },
    include: taskInclude,
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: task.contactId,
      opportunityId: task.opportunityId,
      propertyId: task.propertyId,
      actorUserId,
      type: "TASK",
      subject: "Task updated",
      body: updated.title,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Task",
    entityId: taskId,
    action: "UPDATE",
    before: {
      title: task.title,
      dueAt: task.dueAt,
      priority: task.priority,
      recurrenceRule: task.recurrenceRule,
    },
    after: {
      title: updated.title,
      dueAt: updated.dueAt,
      priority: updated.priority,
      recurrenceRule: updated.recurrenceRule,
    },
  })

  return updated
}

export async function rescheduleTask(
  organizationId: string,
  actorUserId: string,
  taskId: string,
  dueAt: Date,
) {
  return updateTask(organizationId, actorUserId, taskId, { dueAt })
}

export function resolveSnoozeUntil(preset: string, customUntil?: Date | null): Date {
  const now = new Date()
  switch (preset) {
    case "1h":
      return addHours(now, 1)
    case "tomorrow": {
      const tomorrow = addDays(now, 1)
      return setSeconds(setMinutes(setHours(tomorrow, 9), 0), 0)
    }
    case "3d":
      return addDays(now, 3)
    case "next_week":
      return setSeconds(setMinutes(setHours(nextMonday(now), 9), 0), 0)
    case "custom":
      if (!customUntil) throw new Error("Custom snooze requires a datetime")
      return customUntil
    default:
      throw new Error("Unknown snooze preset")
  }
}

export async function snoozeTask(
  organizationId: string,
  actorUserId: string,
  taskId: string,
  snoozedUntil: Date,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId },
  })
  if (!task) return null

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "SNOOZED",
      snoozedUntil,
    },
    include: taskInclude,
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: task.contactId,
      opportunityId: task.opportunityId,
      propertyId: task.propertyId,
      actorUserId,
      type: "TASK",
      subject: "Task snoozed",
      body: `${task.title} until ${snoozedUntil.toISOString()}`,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Task",
    entityId: taskId,
    action: "SNOOZE",
    before: { status: task.status, snoozedUntil: task.snoozedUntil },
    after: { status: "SNOOZED", snoozedUntil },
  })

  return updated
}

export async function cancelTask(
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
    data: { status: "CANCELLED", snoozedUntil: null },
    include: taskInclude,
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: task.contactId,
      opportunityId: task.opportunityId,
      propertyId: task.propertyId,
      actorUserId,
      type: "TASK",
      subject: "Task cancelled",
      body: task.title,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Task",
    entityId: taskId,
    action: "CANCEL",
    before: { status: task.status },
    after: { status: "CANCELLED" },
  })

  return updated
}

/** Pure helper — advance due date by recurrence rule. */
export function nextDueAt(
  from: Date | null | undefined,
  rule: TaskRecurrenceRule | "NONE" | "DAILY" | "WEEKLY" | "MONTHLY",
  now = new Date(),
): Date | null {
  if (rule === "NONE") return null
  const base = from && from > now ? from : now
  switch (rule) {
    case "DAILY":
      return addDays(base, 1)
    case "WEEKLY":
      return addWeeks(base, 1)
    case "MONTHLY":
      return addMonths(base, 1)
    default:
      return null
  }
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
    data: { status: "COMPLETED", completedAt: new Date(), snoozedUntil: null },
    include: taskInclude,
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

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Task",
    entityId: taskId,
    action: "COMPLETE",
    before: { status: task.status },
    after: { status: "COMPLETED" },
  })

  let nextTask = null
  if (task.recurrenceRule !== "NONE") {
    const due = nextDueAt(task.dueAt, task.recurrenceRule)
    nextTask = await prisma.task.create({
      data: {
        organizationId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        dueAt: due,
        contactId: task.contactId,
        opportunityId: task.opportunityId,
        propertyId: task.propertyId,
        assigneeUserId: task.assigneeUserId,
        recurrenceRule: task.recurrenceRule,
        recurrenceParentId: task.recurrenceParentId ?? task.id,
        status: "OPEN",
      },
      include: taskInclude,
    })

    await prisma.activity.create({
      data: {
        organizationId,
        contactId: task.contactId,
        opportunityId: task.opportunityId,
        propertyId: task.propertyId,
        actorUserId,
        type: "TASK",
        subject: "Recurring task created",
        body: `${task.title} (${task.recurrenceRule.toLowerCase()})`,
      },
    })
  }

  const { dispatchWorkflowEvent } = await import("@/domain/workflows/engine")
  void dispatchWorkflowEvent({
    organizationId,
    trigger: "TASK_COMPLETED",
    contactId: task.contactId,
    opportunityId: task.opportunityId,
    actorUserId,
  })

  return { task: updated, nextTask }
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
  filters?: { from?: Date; to?: Date; status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" },
) {
  const where: Prisma.AppointmentWhereInput = {
    organizationId,
    status: filters?.status ?? "SCHEDULED",
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

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Appointment",
    entityId: appointment.id,
    action: "CREATE",
    after: { title: appointment.title, startsAt: appointment.startsAt },
  })

  return appointment
}

export async function completeAppointment(
  organizationId: string,
  actorUserId: string,
  appointmentId: string,
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId },
  })
  if (!appointment) return null

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED" },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: appointment.contactId,
      propertyId: appointment.propertyId,
      actorUserId,
      type: "APPOINTMENT",
      subject: "Appointment completed",
      body: appointment.title,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Appointment",
    entityId: appointmentId,
    action: "COMPLETE",
    before: { status: appointment.status },
    after: { status: "COMPLETED" },
  })

  return updated
}

export async function cancelAppointment(
  organizationId: string,
  actorUserId: string,
  appointmentId: string,
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId },
  })
  if (!appointment) return null

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: appointment.contactId,
      propertyId: appointment.propertyId,
      actorUserId,
      type: "APPOINTMENT",
      subject: "Appointment cancelled",
      body: appointment.title,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Appointment",
    entityId: appointmentId,
    action: "CANCEL",
    before: { status: appointment.status },
    after: { status: "CANCELLED" },
  })

  return updated
}

export async function rescheduleAppointment(
  organizationId: string,
  actorUserId: string,
  appointmentId: string,
  startsAt: Date,
  endsAt?: Date | null,
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId },
  })
  if (!appointment) return null

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      startsAt,
      ...(endsAt !== undefined ? { endsAt } : {}),
      status: "SCHEDULED",
    },
  })

  await prisma.activity.create({
    data: {
      organizationId,
      contactId: appointment.contactId,
      propertyId: appointment.propertyId,
      actorUserId,
      type: "APPOINTMENT",
      subject: "Appointment rescheduled",
      body: `${appointment.title} → ${startsAt.toISOString()}`,
      occurredAt: startsAt,
    },
  })

  await writeAuditLog({
    organizationId,
    actorUserId,
    entityType: "Appointment",
    entityId: appointmentId,
    action: "RESCHEDULE",
    before: { startsAt: appointment.startsAt, endsAt: appointment.endsAt },
    after: { startsAt, endsAt: endsAt ?? appointment.endsAt },
  })

  return updated
}
