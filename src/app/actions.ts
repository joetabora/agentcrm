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
