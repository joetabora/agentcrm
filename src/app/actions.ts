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
  createOpportunity,
  createOpportunitySchema,
  moveOpportunityStage,
} from "@/domain/opportunities/service"
import { createProperty, createPropertySchema } from "@/domain/properties/service"
import {
  completeTask,
  createAppointment,
  createAppointmentSchema,
  createTask,
  createTaskSchema,
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
  await moveOpportunityStage(ctx.organization.id, ctx.user.id, opportunityId, pipelineStageId)
  redirect("/app/pipeline")
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
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input")
  }
  await createTask(ctx.organization.id, ctx.user.id, parsed.data)
  redirect("/app/tasks")
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const taskId = String(formData.get("taskId") ?? "")
  await completeTask(ctx.organization.id, ctx.user.id, taskId)
  redirect("/app/tasks")
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

export async function reassignOpportunityAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext()
  const opportunityId = String(formData.get("opportunityId") ?? "")
  const toUserId = String(formData.get("toUserId") ?? ctx.user.id)
  await assignOpportunity(ctx.organization.id, ctx.user.id, opportunityId, toUserId)
  redirect("/app/leads")
}
