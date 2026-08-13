"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { createOrganizationForUser, getMembershipForUser } from "@/domain/orgs/service"
import {
  createContact,
  createContactSchema,
  updateContact,
} from "@/domain/contacts/service"
import {
  assignOpportunity,
  bulkUpdateOpportunities,
  createOpportunity,
  createOpportunitySchema,
  moveOpportunityStage,
  setOpportunityTemperature,
} from "@/domain/opportunities/service"
import {
  createSavedView,
  createSavedViewSchema,
  deleteSavedView,
} from "@/domain/saved-views/service"
import {
  createRoutingRule,
  createRoutingRuleSchema,
  deleteRoutingRule,
  updateRoutingRule,
} from "@/domain/routing/service"
import { createProperty, createPropertySchema } from "@/domain/properties/service"
import {
  cancelAppointment,
  cancelTask,
  completeAppointment,
  completeTask,
  createAppointment,
  createAppointmentSchema,
  createTask,
  createTaskSchema,
  rescheduleAppointment,
  rescheduleTask,
  resolveSnoozeUntil,
  snoozeTask,
} from "@/domain/tasks/service"
import {
  createWorkflow,
  createWorkflowSchema,
  deleteWorkflow,
  updateWorkflowStatus,
} from "@/domain/workflows/service"
import { enrollManually } from "@/domain/workflows/engine"
import type { WorkflowDefinition } from "@/domain/workflows/definition"
import { addNote, createNoteSchema } from "@/domain/activities/service"
import { requireOrgContext, requireSession } from "@/server/session"

export async function signUpAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const organizationName =
    String(formData.get("organizationName") ?? "").trim() || `${name}'s Realty`

  if (!name || !email || password.length < 8) {
    redirect("/sign-up?error=missing_fields")
  }

  let userId: string
  try {
    // nextCookies() sets the session cookie on the response. Do not call
    // getSession() with the incoming request headers — they won't include it yet.
    const created = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    })
    if (!created?.user?.id) {
      redirect("/sign-up?error=signup_failed")
    }
    userId = created.user.id
  } catch {
    redirect("/sign-up?error=signup_failed")
  }

  const existing = await getMembershipForUser(userId)
  if (!existing) {
    await createOrganizationForUser({
      userId,
      name: organizationName,
    })
  }

  redirect("/app")
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  let userId: string
  try {
    const signedIn = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    })
    if (!signedIn?.user?.id) {
      redirect("/sign-in?error=invalid_credentials")
    }
    userId = signedIn.user.id
  } catch {
    redirect("/sign-in?error=invalid_credentials")
  }

  // Repair accounts created before org provisioning succeeded
  const existing = await getMembershipForUser(userId)
  if (!existing) {
    await createOrganizationForUser({
      userId,
      name: `${email.split("@")[0]}'s Realty`,
    })
  }

  redirect("/app")
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() })
  redirect("/sign-in")
}

export async function createOrgAction(formData: FormData): Promise<void> {
  const session = await requireSession()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) throw new Error("Organization name is required.")

  const existing = await getMembershipForUser(session.user.id)
  if (existing) redirect("/app")

  await createOrganizationForUser({ userId: session.user.id, name })
  redirect("/app")
}

export async function createContactAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const parsed = createContactSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    preferredName: formData.get("preferredName") || null,
    contactType: formData.get("contactType") || "LEAD",
    lifecycleStage: formData.get("lifecycleStage") || "NEW",
    temperature: formData.get("temperature") || null,
    source: formData.get("source") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    notesSummary: formData.get("notesSummary") || null,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input")
  }

  const contact = await createContact(ctx.organization.id, ctx.user.id, parsed.data)
  redirect(`/app/contacts/${contact.id}`)
}

export async function updateContactAction(contactId: string, formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  await updateContact(ctx.organization.id, ctx.user.id, contactId, {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    preferredName: String(formData.get("preferredName") ?? "") || null,
    contactType: formData.get("contactType") as never,
    lifecycleStage: formData.get("lifecycleStage") as never,
    temperature: (formData.get("temperature") as never) || null,
    source: String(formData.get("source") ?? "") || null,
    notesSummary: String(formData.get("notesSummary") ?? "") || null,
  })
  redirect(`/app/contacts/${contactId}`)
}

export async function addNoteAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const parsed = createNoteSchema.safeParse({
    contactId: formData.get("contactId"),
    body: formData.get("body"),
    subject: formData.get("subject") || "Note",
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid note")
  }
  await addNote(ctx.organization.id, ctx.user.id, parsed.data)
  redirect(`/app/contacts/${parsed.data.contactId}`)
}

export async function syncAddNoteAction(input: {
  contactId: string
  body: string
  subject?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await requireOrgContext()
    const parsed = createNoteSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note" }
    }
    await addNote(ctx.organization.id, ctx.user.id, parsed.data)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to add note" }
  }
}

export async function createOpportunityAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const parsed = createOpportunitySchema.safeParse({
    contactId: formData.get("contactId"),
    type: formData.get("type"),
    title: formData.get("title"),
    source: formData.get("source") || null,
    temperature: formData.get("temperature") || "WARM",
    estimatedValue: formData.get("estimatedValue")
      ? Number(formData.get("estimatedValue"))
      : null,
    nextAction: formData.get("nextAction") || null,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input")
  }
  await createOpportunity(ctx.organization.id, ctx.user.id, parsed.data)
  redirect("/app/leads")
}

export async function moveStageAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const opportunityId = String(formData.get("opportunityId") ?? "")
  const pipelineStageId = String(formData.get("pipelineStageId") ?? "")
  const redirectTo = String(formData.get("redirectTo") ?? "/app/pipeline")
  await moveOpportunityStage(ctx.organization.id, ctx.user.id, opportunityId, pipelineStageId)
  redirect(redirectTo.startsWith("/app/") ? redirectTo : "/app/pipeline")
}

export async function setTemperatureAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const opportunityId = String(formData.get("opportunityId") ?? "")
  const temperature = String(formData.get("temperature") ?? "") as "COLD" | "WARM" | "HOT"
  await setOpportunityTemperature(ctx.organization.id, ctx.user.id, opportunityId, temperature)
  redirect(`/app/leads/${opportunityId}`)
}

export async function reassignOpportunityAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const opportunityId = String(formData.get("opportunityId") ?? "")
  const toUserId = String(formData.get("toUserId") ?? ctx.user.id)
  const reason = String(formData.get("reason") ?? "") || undefined
  const redirectTo = String(formData.get("redirectTo") ?? "/app/leads")
  await assignOpportunity(ctx.organization.id, ctx.user.id, opportunityId, toUserId, reason)
  redirect(redirectTo.startsWith("/app/") ? redirectTo : "/app/leads")
}

export async function bulkUpdateOpportunitiesAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const opportunityIds = formData.getAll("opportunityIds").map(String)
  const pipelineStageId = String(formData.get("pipelineStageId") ?? "") || undefined
  const temperatureRaw = String(formData.get("temperature") ?? "")
  const assignToUserId = String(formData.get("assignToUserId") ?? "") || undefined
  const temperature =
    temperatureRaw === "COLD" || temperatureRaw === "WARM" || temperatureRaw === "HOT"
      ? temperatureRaw
      : undefined

  await bulkUpdateOpportunities(ctx.organization.id, ctx.user.id, opportunityIds, {
    pipelineStageId,
    temperature,
    assignToUserId,
  })
}

export async function createSavedViewAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  let filters: Record<string, unknown> = {}
  try {
    filters = JSON.parse(String(formData.get("filtersJson") ?? "{}")) as Record<string, unknown>
  } catch {
    filters = {}
  }
  const parsed = createSavedViewSchema.safeParse({
    name: formData.get("name"),
    entity: formData.get("entity") || "LEADS",
    filters,
    isShared: formData.get("isShared") === "1",
  })
  if (!parsed.success) {
    redirect("/app/leads?error=invalid_view")
  }
  await createSavedView(ctx.organization.id, ctx.user.id, parsed.data)
  redirect("/app/leads")
}

export async function deleteSavedViewAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const viewId = String(formData.get("viewId") ?? "")
  await deleteSavedView(ctx.organization.id, ctx.user.id, viewId)
  redirect("/app/leads")
}

export async function createRoutingRuleAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const conditions: Record<string, unknown> = {}
  const type = String(formData.get("type") ?? "")
  const temperature = String(formData.get("temperature") ?? "")
  const sourceContains = String(formData.get("sourceContains") ?? "").trim()
  const minEstimatedValue = formData.get("minEstimatedValue")
    ? Number(formData.get("minEstimatedValue"))
    : undefined
  const maxEstimatedValue = formData.get("maxEstimatedValue")
    ? Number(formData.get("maxEstimatedValue"))
    : undefined
  if (type === "BUYER" || type === "SELLER") conditions.type = type
  if (temperature === "COLD" || temperature === "WARM" || temperature === "HOT") {
    conditions.temperature = temperature
  }
  if (sourceContains) conditions.sourceContains = sourceContains
  if (minEstimatedValue != null && !Number.isNaN(minEstimatedValue)) {
    conditions.minEstimatedValue = minEstimatedValue
  }
  if (maxEstimatedValue != null && !Number.isNaN(maxEstimatedValue)) {
    conditions.maxEstimatedValue = maxEstimatedValue
  }

  const parsed = createRoutingRuleSchema.safeParse({
    name: formData.get("name"),
    position: Number(formData.get("position") ?? 0),
    assignMode: formData.get("assignMode") || "SPECIFIC_USER",
    targetUserId: formData.get("targetUserId") || null,
    conditions,
    enabled: true,
  })
  if (!parsed.success) {
    redirect("/app/settings/routing?error=invalid_rule")
  }
  await createRoutingRule(ctx.organization.id, parsed.data)
  redirect("/app/settings/routing")
}

export async function toggleRoutingRuleAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const ruleId = String(formData.get("ruleId") ?? "")
  const enabled = formData.get("enabled") === "1"
  await updateRoutingRule(ctx.organization.id, ruleId, { enabled })
  redirect("/app/settings/routing")
}

export async function deleteRoutingRuleAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const ruleId = String(formData.get("ruleId") ?? "")
  await deleteRoutingRule(ctx.organization.id, ruleId)
  redirect("/app/settings/routing")
}

export async function updatePipelineStageAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { updatePipelineStage } = await import("@/domain/opportunities/service")
  const stageId = String(formData.get("stageId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const positionRaw = formData.get("position")
  const position = positionRaw != null && String(positionRaw) !== "" ? Number(positionRaw) : undefined
  await updatePipelineStage(ctx.organization.id, stageId, {
    name: name || undefined,
    position: position != null && !Number.isNaN(position) ? position : undefined,
  })
  const type = String(formData.get("pipelineType") ?? "BUYER")
  redirect(`/app/pipeline?type=${type === "SELLER" ? "SELLER" : "BUYER"}&configure=1`)
}

export async function createPropertyAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const parsed = createPropertySchema.safeParse({
    line1: formData.get("line1"),
    line2: formData.get("line2") || null,
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    propertyType: formData.get("propertyType") || null,
    beds: formData.get("beds") ? Number(formData.get("beds")) : null,
    baths: formData.get("baths") ? Number(formData.get("baths")) : null,
    sqft: formData.get("sqft") ? Number(formData.get("sqft")) : null,
    listPrice: formData.get("listPrice") ? Number(formData.get("listPrice")) : null,
    listedAt: formData.get("listedAt") || null,
    status: formData.get("status") || "UNKNOWN",
    description: formData.get("description") || null,
    contactId: formData.get("contactId") || null,
    contactRole: formData.get("contactRole") || "OWNER",
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input")
  }
  const property = await createProperty(ctx.organization.id, ctx.user.id, parsed.data)
  redirect(`/app/properties/${property.id}`)
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    priority: formData.get("priority") || "MEDIUM",
    category: formData.get("category") || null,
    dueAt: formData.get("dueAt") || null,
    contactId: formData.get("contactId") || null,
    opportunityId: formData.get("opportunityId") || null,
    propertyId: formData.get("propertyId") || null,
    recurrenceRule: formData.get("recurrenceRule") || "NONE",
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input")
  }
  await createTask(ctx.organization.id, ctx.user.id, parsed.data)
  redirect("/app/tasks")
}

function taskRedirect(formData: FormData) {
  const to = String(formData.get("redirectTo") ?? "/app/tasks")
  return to.startsWith("/app") ? to : "/app/tasks"
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const taskId = String(formData.get("taskId") ?? "")
  await completeTask(ctx.organization.id, ctx.user.id, taskId)
  redirect(taskRedirect(formData))
}

export async function syncCompleteTaskAction(
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await requireOrgContext()
    if (!taskId) return { ok: false, error: "Missing task id" }
    const updated = await completeTask(ctx.organization.id, ctx.user.id, taskId)
    if (!updated) return { ok: false, error: "Task not found" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to complete task" }
  }
}

export async function snoozeTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const taskId = String(formData.get("taskId") ?? "")
  const preset = String(formData.get("preset") ?? "tomorrow")
  const customRaw = formData.get("snoozedUntil")
  const customUntil =
    typeof customRaw === "string" && customRaw.length > 0 ? new Date(customRaw) : null
  const until = resolveSnoozeUntil(preset, customUntil)
  await snoozeTask(ctx.organization.id, ctx.user.id, taskId, until)
  redirect(taskRedirect(formData))
}

export async function rescheduleTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const taskId = String(formData.get("taskId") ?? "")
  const dueAt = new Date(String(formData.get("dueAt") ?? ""))
  if (Number.isNaN(dueAt.getTime())) throw new Error("Invalid due date")
  await rescheduleTask(ctx.organization.id, ctx.user.id, taskId, dueAt)
  redirect(taskRedirect(formData))
}

export async function cancelTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const taskId = String(formData.get("taskId") ?? "")
  await cancelTask(ctx.organization.id, ctx.user.id, taskId)
  redirect(taskRedirect(formData))
}

export async function createAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const parsed = createAppointmentSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    location: formData.get("location") || null,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || null,
    contactId: formData.get("contactId") || null,
    propertyId: formData.get("propertyId") || null,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input")
  }
  await createAppointment(ctx.organization.id, ctx.user.id, parsed.data)
  redirect("/app/tasks")
}

export async function completeAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const appointmentId = String(formData.get("appointmentId") ?? "")
  await completeAppointment(ctx.organization.id, ctx.user.id, appointmentId)
  redirect(taskRedirect(formData))
}

export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const appointmentId = String(formData.get("appointmentId") ?? "")
  await cancelAppointment(ctx.organization.id, ctx.user.id, appointmentId)
  redirect(taskRedirect(formData))
}

export async function rescheduleAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const appointmentId = String(formData.get("appointmentId") ?? "")
  const startsAt = new Date(String(formData.get("startsAt") ?? ""))
  const endsRaw = formData.get("endsAt")
  const endsAt =
    typeof endsRaw === "string" && endsRaw.length > 0 ? new Date(endsRaw) : null
  if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start time")
  await rescheduleAppointment(
    ctx.organization.id,
    ctx.user.id,
    appointmentId,
    startsAt,
    endsAt,
  )
  redirect(taskRedirect(formData))
}

function parseWorkflowFilter(formData: FormData) {
  const filter: Record<string, string> = {}
  const type = String(formData.get("filterType") ?? "")
  const temperature = String(formData.get("filterTemperature") ?? "")
  const stageKey = String(formData.get("filterStageKey") ?? "").trim()
  const sourceContains = String(formData.get("filterSourceContains") ?? "").trim()
  if (type === "BUYER" || type === "SELLER") filter.type = type
  if (temperature === "COLD" || temperature === "WARM" || temperature === "HOT") {
    filter.temperature = temperature
  }
  if (stageKey) filter.stageKey = stageKey
  if (sourceContains) filter.sourceContains = sourceContains
  return filter
}

/** Build a guided linear definition from the settings form. */
function buildGuidedWorkflowDefinition(formData: FormData): WorkflowDefinition {
  const trigger = String(formData.get("trigger") ?? "OPPORTUNITY_CREATED")
  const triggerFilter = parseWorkflowFilter(formData)
  const taskTitle = String(formData.get("taskTitle") ?? "").trim() || "Workflow follow-up"
  const taskPriority = String(formData.get("taskPriority") ?? "MEDIUM")
  const dueInHoursRaw = String(formData.get("dueInHours") ?? "")
  const dueInHours = dueInHoursRaw ? Number(dueInHoursRaw) : undefined
  const waitHoursRaw = String(formData.get("waitHours") ?? "")
  const waitHours = waitHoursRaw ? Number(waitHoursRaw) : 0
  const noteBody = String(formData.get("noteBody") ?? "").trim()
  const moveStageKey = String(formData.get("moveStageKey") ?? "").trim()
  const branchTemperature = String(formData.get("branchTemperature") ?? "")
  const sendEmailBody = String(formData.get("sendEmailBody") ?? "").trim()
  const sendEmailSubject = String(formData.get("sendEmailSubject") ?? "").trim()
  const sendSmsBody = String(formData.get("sendSmsBody") ?? "").trim()

  const steps: WorkflowDefinition["steps"] = []

  const afterTaskNext = (): string => {
    if (noteBody) return "add_note"
    if (moveStageKey) return "move_stage"
    if (sendEmailBody || sendEmailSubject) return "send_email"
    if (sendSmsBody) return "send_sms"
    if (waitHours > 0) return "delay"
    return "exit"
  }
  const afterNoteNext = (): string => {
    if (moveStageKey) return "move_stage"
    if (sendEmailBody || sendEmailSubject) return "send_email"
    if (sendSmsBody) return "send_sms"
    if (waitHours > 0) return "delay"
    return "exit"
  }
  const afterStageNext = (): string => {
    if (sendEmailBody || sendEmailSubject) return "send_email"
    if (sendSmsBody) return "send_sms"
    if (waitHours > 0) return "delay"
    return "exit"
  }
  const afterEmailNext = (): string => {
    if (sendSmsBody) return "send_sms"
    if (waitHours > 0) return "delay"
    return "exit"
  }
  const afterSmsNext = (): string => (waitHours > 0 ? "delay" : "exit")

  if (branchTemperature === "HOT" || branchTemperature === "WARM" || branchTemperature === "COLD") {
    steps.push({
      key: "branch_temp",
      type: "BRANCH",
      conditions: { temperature: branchTemperature },
      nextKey: "create_task",
      elseKey: "exit",
    })
  }

  steps.push({
    key: "create_task",
    type: "ACTION_CREATE_TASK",
    title: taskTitle,
    priority:
      taskPriority === "LOW" ||
      taskPriority === "HIGH" ||
      taskPriority === "URGENT" ||
      taskPriority === "MEDIUM"
        ? taskPriority
        : "MEDIUM",
    dueInHours: dueInHours != null && !Number.isNaN(dueInHours) ? dueInHours : undefined,
    nextKey: afterTaskNext(),
  })

  if (noteBody) {
    steps.push({
      key: "add_note",
      type: "ACTION_ADD_NOTE",
      body: noteBody,
      nextKey: afterNoteNext(),
    })
  }

  if (moveStageKey) {
    steps.push({
      key: "move_stage",
      type: "ACTION_MOVE_STAGE",
      stageKey: moveStageKey,
      nextKey: afterStageNext(),
    })
  }

  if (sendEmailBody || sendEmailSubject) {
    steps.push({
      key: "send_email",
      type: "ACTION_SEND_EMAIL",
      subject: sendEmailSubject || "Follow-up",
      body: sendEmailBody || "Hello {{firstName}}, following up.",
      nextKey: afterEmailNext(),
    })
  }

  if (sendSmsBody) {
    steps.push({
      key: "send_sms",
      type: "ACTION_SEND_SMS",
      body: sendSmsBody,
      nextKey: afterSmsNext(),
    })
  }

  if (waitHours > 0) {
    steps.push({
      key: "delay",
      type: "DELAY",
      waitHours,
      nextKey: "exit",
    })
  }

  steps.push({ key: "exit", type: "EXIT" })

  return {
    trigger: trigger as WorkflowDefinition["trigger"],
    triggerFilter,
    steps,
  }
}

export async function createWorkflowAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const definition = buildGuidedWorkflowDefinition(formData)
  const parsed = createWorkflowSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    status: formData.get("status") || "DRAFT",
    definition,
  })
  if (!parsed.success) {
    redirect("/app/settings/workflows?error=invalid")
  }
  await createWorkflow(ctx.organization.id, parsed.data)
  redirect("/app/settings/workflows")
}

export async function setWorkflowStatusAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const workflowId = String(formData.get("workflowId") ?? "")
  const status = String(formData.get("status") ?? "") as
    | "DRAFT"
    | "ACTIVE"
    | "PAUSED"
    | "ARCHIVED"
  await updateWorkflowStatus(ctx.organization.id, workflowId, status)
  redirect("/app/settings/workflows")
}

export async function deleteWorkflowAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const workflowId = String(formData.get("workflowId") ?? "")
  await deleteWorkflow(ctx.organization.id, workflowId)
  redirect("/app/settings/workflows")
}

export async function enrollWorkflowAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const workflowId = String(formData.get("workflowId") ?? "")
  const opportunityId = String(formData.get("opportunityId") ?? "") || null
  const contactId = String(formData.get("contactId") ?? "") || null
  const redirectTo = String(formData.get("redirectTo") ?? "/app")
  await enrollManually({
    organizationId: ctx.organization.id,
    workflowId,
    opportunityId,
    contactId,
    actorUserId: ctx.user.id,
  })
  redirect(redirectTo.startsWith("/app") ? redirectTo : "/app")
}

export async function createTemplateAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { createTemplate, createTemplateSchema } = await import("@/domain/comms/service")
  const parsed = createTemplateSchema.safeParse({
    channel: formData.get("channel"),
    name: formData.get("name"),
    subject: formData.get("subject") || null,
    body: formData.get("body"),
  })
  if (!parsed.success) redirect("/app/settings/templates?error=invalid")
  await createTemplate(ctx.organization.id, parsed.data)
  redirect("/app/settings/templates")
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { deleteTemplate } = await import("@/domain/comms/service")
  await deleteTemplate(ctx.organization.id, String(formData.get("templateId") ?? ""))
  redirect("/app/settings/templates")
}

export async function sendEmailAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { sendEmail } = await import("@/domain/comms/service")
  const contactId = String(formData.get("contactId") ?? "")
  const result = await sendEmail({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    contactId,
    subject: String(formData.get("subject") ?? "") || null,
    body: String(formData.get("body") ?? "") || null,
    templateId: String(formData.get("templateId") ?? "") || null,
    agentName: ctx.user.name,
    source: "USER",
  })
  if (!result.ok) {
    redirect(`/app/contacts/${contactId}?error=${encodeURIComponent(result.error)}`)
  }
  redirect(`/app/contacts/${contactId}`)
}

export async function sendSmsAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { sendSms } = await import("@/domain/comms/service")
  const contactId = String(formData.get("contactId") ?? "")
  const result = await sendSms({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    contactId,
    body: String(formData.get("body") ?? "") || null,
    templateId: String(formData.get("templateId") ?? "") || null,
    agentName: ctx.user.name,
    source: "USER",
  })
  if (!result.ok) {
    redirect(`/app/contacts/${contactId}?error=${encodeURIComponent(result.error)}`)
  }
  redirect(`/app/contacts/${contactId}`)
}

export async function updateConsentAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { updateContactConsent } = await import("@/domain/comms/service")
  const contactId = String(formData.get("contactId") ?? "")
  await updateContactConsent(ctx.organization.id, ctx.user.id, contactId, {
    doNotContact: formData.get("doNotContact") === "on" || formData.get("doNotContact") === "true",
    consentEmail: formData.get("consentEmail") === "on" || formData.get("consentEmail") === "true",
    consentSms: formData.get("consentSms") === "on" || formData.get("consentSms") === "true",
    consentCall: formData.get("consentCall") === "on" || formData.get("consentCall") === "true",
  })
  redirect(`/app/contacts/${contactId}`)
}

export async function updateBuyerPreferencesAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const {
    updateBuyerPreferences,
  } = await import("@/domain/properties/service")
  const { parseListField } = await import("@/domain/properties/preferences")
  const contactId = String(formData.get("contactId") ?? "")
  const bedsMin = formData.get("bedsMin") ? Number(formData.get("bedsMin")) : undefined
  const bathsMin = formData.get("bathsMin") ? Number(formData.get("bathsMin")) : undefined
  const maxDom = formData.get("maxDom") ? Number(formData.get("maxDom")) : undefined
  await updateBuyerPreferences(ctx.organization.id, ctx.user.id, contactId, {
    budgetMin: formData.get("budgetMin") ? Number(formData.get("budgetMin")) : null,
    budgetMax: formData.get("budgetMax") ? Number(formData.get("budgetMax")) : null,
    preferences: {
      bedsMin: bedsMin != null && !Number.isNaN(bedsMin) ? bedsMin : undefined,
      bathsMin: bathsMin != null && !Number.isNaN(bathsMin) ? bathsMin : undefined,
      maxDom: maxDom != null && !Number.isNaN(maxDom) ? maxDom : undefined,
      cities: parseListField(String(formData.get("cities") ?? "")),
      zips: parseListField(String(formData.get("zips") ?? "")),
      propertyTypes: parseListField(String(formData.get("propertyTypes") ?? "")),
    },
  })
  redirect(`/app/contacts/${contactId}`)
}

export async function saveBuyerInterestAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { saveBuyerInterest } = await import("@/domain/properties/service")
  const contactId = String(formData.get("contactId") ?? "")
  const propertyId = String(formData.get("propertyId") ?? "")
  const redirectTo = String(formData.get("redirectTo") ?? `/app/contacts/${contactId}`)
  await saveBuyerInterest(ctx.organization.id, ctx.user.id, contactId, propertyId)
  redirect(redirectTo.startsWith("/app") ? redirectTo : `/app/contacts/${contactId}`)
}

export async function updateListedAtAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { updatePropertyListedAt } = await import("@/domain/properties/service")
  const propertyId = String(formData.get("propertyId") ?? "")
  const raw = String(formData.get("listedAt") ?? "")
  const listedAt = raw ? new Date(raw) : null
  await updatePropertyListedAt(ctx.organization.id, ctx.user.id, propertyId, listedAt)
  redirect(`/app/properties/${propertyId}`)
}

export async function addPriceEventAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { addPropertyPriceEvent } = await import("@/domain/properties/service")
  const propertyId = String(formData.get("propertyId") ?? "")
  const price = Number(formData.get("price"))
  if (Number.isNaN(price)) throw new Error("Invalid price")
  await addPropertyPriceEvent(ctx.organization.id, ctx.user.id, propertyId, {
    price,
    note: String(formData.get("note") ?? "") || null,
  })
  redirect(`/app/properties/${propertyId}`)
}

export async function askAssistantAction(input: {
  question: string
  contactId?: string | null
  opportunityId?: string | null
}) {
  const ctx = await requireOrgContext()
  const { askAssistant } = await import("@/domain/ai/assistant")
  return askAssistant({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    question: input.question,
    contactId: input.contactId || null,
    opportunityId: input.opportunityId || null,
  })
}

export async function createContactFactAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { createContactFact } = await import("@/domain/ai/assistant")
  const contactId = String(formData.get("contactId") ?? "")
  const statement = String(formData.get("statement") ?? "")
  const fromAi = String(formData.get("fromAi") ?? "") === "1"
  const redirectTo = String(formData.get("redirectTo") ?? "")
  const fact = await createContactFact({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    contactId,
    statement,
    fromAi,
  })
  if (!fact) redirect("/app/contacts?error=not_found")
  redirect(
    redirectTo.startsWith("/app/") ? redirectTo : `/app/contacts/${contactId}`,
  )
}

export async function confirmAssistantActionAction(input: {
  tool: string
  args: Record<string, unknown>
}) {
  const ctx = await requireOrgContext()
  const { confirmAssistantAction } = await import("@/domain/ai/execute")
  return confirmAssistantAction({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    role: ctx.membership.role,
    tool: input.tool,
    args: input.args,
  })
}

export async function createCampaignAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { createCampaign } = await import("@/domain/campaigns/service")

  const channel = String(formData.get("channel") ?? "EMAIL") === "SMS" ? "SMS" : "EMAIL"
  const waitHours = Number(formData.get("waitHours") ?? "24")
  const sendBody = String(formData.get("sendBody") ?? "").trim()
  const sendSubject = String(formData.get("sendSubject") ?? "").trim()

  const definition = {
    entryKey: "delay1",
    steps: [
      {
        key: "delay1",
        type: "DELAY" as const,
        waitHours: Number.isFinite(waitHours) && waitHours > 0 ? waitHours : 24,
        nextKey: channel === "SMS" ? "sms1" : "email1",
      },
      channel === "SMS"
        ? {
            key: "sms1",
            type: "SEND_SMS" as const,
            body: sendBody || "Hi {{firstName}}, checking in from {{organizationName}}.",
            nextKey: "exit",
          }
        : {
            key: "email1",
            type: "SEND_EMAIL" as const,
            subject: sendSubject || "Hello {{firstName}}",
            body:
              sendBody ||
              "Hi {{firstName}},\n\nJust checking in from {{organizationName}}.\n\n— {{agentName}}",
            nextKey: "exit",
          },
      { key: "exit", type: "EXIT" as const },
    ],
  }

  const empty = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim()
    return s.length ? s : null
  }

  const audience = {
    requireConsent: true as const,
    contactType: empty(formData.get("contactType")) as
      | "LEAD"
      | "BUYER"
      | "SELLER"
      | null,
    lifecycleStage: empty(formData.get("lifecycleStage")) as "NEW" | "NURTURE" | null,
    temperature: empty(formData.get("temperature")) as "COLD" | "WARM" | "HOT" | null,
    sourceContains: empty(formData.get("sourceContains")),
    tagName: empty(formData.get("tagName")),
  }

  const campaign = await createCampaign(ctx.organization.id, ctx.user.id, {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "") || null,
    channel,
    definition,
    audience,
  })
  redirect(`/app/campaigns/${campaign.id}`)
}

export async function submitCampaignAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { submitCampaignForApproval } = await import("@/domain/campaigns/service")
  const campaignId = String(formData.get("campaignId") ?? "")
  await submitCampaignForApproval(ctx.organization.id, ctx.user.id, campaignId)
  redirect(`/app/campaigns/${campaignId}`)
}

export async function approveCampaignAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  if (ctx.membership.role === "ASSISTANT") {
    throw new Error("Assistants cannot approve campaigns")
  }
  const { approveCampaign } = await import("@/domain/campaigns/service")
  const campaignId = String(formData.get("campaignId") ?? "")
  await approveCampaign(ctx.organization.id, ctx.user.id, campaignId)
  redirect(`/app/campaigns/${campaignId}`)
}

export async function pauseCampaignAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { pauseCampaign } = await import("@/domain/campaigns/service")
  const campaignId = String(formData.get("campaignId") ?? "")
  await pauseCampaign(ctx.organization.id, ctx.user.id, campaignId)
  redirect(`/app/campaigns/${campaignId}`)
}

export async function enrollCampaignAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { enrollAudience, tickCampaignsForOrg } = await import("@/domain/campaigns/engine")
  const campaignId = String(formData.get("campaignId") ?? "")
  await enrollAudience({
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    campaignId,
  })
  await tickCampaignsForOrg(ctx.organization.id)
  redirect(`/app/campaigns/${campaignId}`)
}

export async function tickCampaignsAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { tickCampaignsForOrg } = await import("@/domain/campaigns/engine")
  const campaignId = String(formData.get("campaignId") ?? "")
  await tickCampaignsForOrg(ctx.organization.id)
  redirect(campaignId ? `/app/campaigns/${campaignId}` : "/app/campaigns")
}

export async function createTransactionFromOpportunityAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requireOrgContext()
  const { createTransactionFromOpportunity } = await import(
    "@/domain/transactions/service"
  )
  const opportunityId = String(formData.get("opportunityId") ?? "")
  const tx = await createTransactionFromOpportunity(
    ctx.organization.id,
    ctx.user.id,
    { opportunityId },
  )
  redirect(`/app/transactions/${tx.id}`)
}

export async function updateTransactionAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { updateTransaction } = await import("@/domain/transactions/service")
  const transactionId = String(formData.get("transactionId") ?? "")
  const purchasePriceRaw = String(formData.get("purchasePrice") ?? "").trim()
  const gciRaw = String(formData.get("gciAmount") ?? "").trim()
  const agentSplitRaw = String(formData.get("agentSplitPercent") ?? "").trim()
  const brokerageSplitRaw = String(formData.get("brokerageSplitPercent") ?? "").trim()
  const closingRaw = String(formData.get("closingDate") ?? "").trim()

  await updateTransaction(ctx.organization.id, ctx.user.id, transactionId, {
    title: String(formData.get("title") ?? "") || undefined,
    status: (String(formData.get("status") ?? "") || undefined) as
      | "OPEN"
      | "UNDER_CONTRACT"
      | "CLOSED"
      | "FELL_THROUGH"
      | "CANCELLED"
      | undefined,
    side: (String(formData.get("side") ?? "") || undefined) as
      | "BUYER"
      | "SELLER"
      | "DUAL"
      | undefined,
    purchasePrice: purchasePriceRaw ? Number(purchasePriceRaw) : undefined,
    gciAmount: gciRaw ? Number(gciRaw) : undefined,
    agentSplitPercent: agentSplitRaw ? Number(agentSplitRaw) : undefined,
    brokerageSplitPercent: brokerageSplitRaw ? Number(brokerageSplitRaw) : undefined,
    closingDate: closingRaw ? new Date(closingRaw) : undefined,
    notes: String(formData.get("notes") ?? "") || null,
  })
  redirect(`/app/transactions/${transactionId}`)
}

export async function addTransactionPartyAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { addParty } = await import("@/domain/transactions/service")
  const transactionId = String(formData.get("transactionId") ?? "")
  const contactId = String(formData.get("contactId") ?? "").trim() || null
  await addParty(ctx.organization.id, ctx.user.id, transactionId, {
    role: String(formData.get("role") ?? "OTHER") as
      | "BUYER"
      | "SELLER"
      | "BUYER_AGENT"
      | "SELLER_AGENT"
      | "LENDER"
      | "ATTORNEY"
      | "TITLE"
      | "OTHER",
    contactId,
    name: String(formData.get("name") ?? "") || undefined,
    email: String(formData.get("email") ?? "") || null,
    isPrimary: String(formData.get("isPrimary") ?? "") === "1",
  })
  redirect(`/app/transactions/${transactionId}`)
}

export async function createOfferAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { createOffer } = await import("@/domain/transactions/service")
  const transactionId = String(formData.get("transactionId") ?? "")
  await createOffer(ctx.organization.id, ctx.user.id, transactionId, {
    amount: Number(formData.get("amount")),
    status: (String(formData.get("status") ?? "DRAFT") || "DRAFT") as
      | "DRAFT"
      | "SUBMITTED"
      | "COUNTERED"
      | "ACCEPTED"
      | "REJECTED"
      | "WITHDRAWN",
    notes: String(formData.get("notes") ?? "") || null,
  })
  redirect(`/app/transactions/${transactionId}`)
}

export async function updateOfferStatusAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { updateOfferStatus } = await import("@/domain/transactions/service")
  const offerId = String(formData.get("offerId") ?? "")
  const transactionId = String(formData.get("transactionId") ?? "")
  await updateOfferStatus(ctx.organization.id, ctx.user.id, offerId, {
    status: String(formData.get("status") ?? "DRAFT") as
      | "DRAFT"
      | "SUBMITTED"
      | "COUNTERED"
      | "ACCEPTED"
      | "REJECTED"
      | "WITHDRAWN",
  })
  redirect(`/app/transactions/${transactionId}`)
}

export async function addDeadlineAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { addDeadline } = await import("@/domain/transactions/service")
  const transactionId = String(formData.get("transactionId") ?? "")
  await addDeadline(ctx.organization.id, ctx.user.id, transactionId, {
    kind: String(formData.get("kind") ?? "OTHER") as
      | "INSPECTION"
      | "FINANCING"
      | "APPRAISAL"
      | "EARNEST_MONEY"
      | "CLOSING"
      | "OTHER",
    label: String(formData.get("label") ?? "").trim(),
    dueAt: new Date(String(formData.get("dueAt") ?? "")),
  })
  redirect(`/app/transactions/${transactionId}`)
}

export async function completeDeadlineAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { completeDeadline } = await import("@/domain/transactions/service")
  const transactionId = String(formData.get("transactionId") ?? "")
  const deadlineId = String(formData.get("deadlineId") ?? "")
  await completeDeadline(ctx.organization.id, ctx.user.id, deadlineId)
  redirect(`/app/transactions/${transactionId}`)
}

export async function setChecklistStatusAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { setChecklistStatus } = await import("@/domain/transactions/service")
  const transactionId = String(formData.get("transactionId") ?? "")
  const itemId = String(formData.get("itemId") ?? "")
  const status = String(formData.get("status") ?? "TODO") as "TODO" | "DONE" | "NA"
  await setChecklistStatus(ctx.organization.id, ctx.user.id, itemId, status)
  redirect(`/app/transactions/${transactionId}`)
}

export async function addChecklistItemAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { addChecklistItem } = await import("@/domain/transactions/service")
  const transactionId = String(formData.get("transactionId") ?? "")
  await addChecklistItem(ctx.organization.id, ctx.user.id, transactionId, {
    title: String(formData.get("title") ?? "").trim(),
  })
  redirect(`/app/transactions/${transactionId}`)
}

export async function createTransactionDocumentAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requireOrgContext()
  const { createTransactionDocument } = await import(
    "@/domain/transactions/documents"
  )
  const transactionId = String(formData.get("transactionId") ?? "")
  await createTransactionDocument(ctx.organization.id, ctx.user.id, transactionId, {
    name: String(formData.get("name") ?? "").trim(),
    contentType: String(formData.get("contentType") ?? "") || null,
    createEnvelope: String(formData.get("createEnvelope") ?? "") === "1",
  })
  redirect(`/app/transactions/${transactionId}`)
}

export async function syncMlsAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { syncFromProvider } = await import("@/domain/mls/service")
  const mlsNumber = String(formData.get("mlsNumber") ?? "").trim() || undefined
  const postalCode = String(formData.get("postalCode") ?? "").trim() || undefined
  await syncFromProvider(ctx.organization.id, ctx.user.id, {
    mlsNumber,
    postalCode,
  })
  redirect("/app/settings/mls?synced=1")
}

export async function importMlsJsonAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const { importResoJson } = await import("@/domain/mls/service")
  const raw = String(formData.get("json") ?? "").trim()
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    redirect("/app/settings/mls?error=invalid_json")
  }
  const result = await importResoJson(ctx.organization.id, ctx.user.id, payload)
  if (result.upserted === 0) {
    redirect(
      `/app/settings/mls?error=${encodeURIComponent(result.errors[0]?.error ?? "no_rows")}`,
    )
  }
  redirect(`/app/settings/mls?imported=${result.upserted}`)
}
