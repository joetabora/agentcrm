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
