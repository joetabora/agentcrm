export type CommChannelKind = "EMAIL" | "SMS" | "CALL"

export type ConsentContact = {
  doNotContact: boolean
  consentEmail: boolean
  consentSms: boolean
  consentCall: boolean
}

export type ConsentDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

export function assertCanSend(
  contact: ConsentContact,
  channel: CommChannelKind,
): ConsentDecision {
  if (contact.doNotContact) {
    return { allowed: false, reason: "Contact is marked do-not-contact" }
  }
  if (channel === "EMAIL" && !contact.consentEmail) {
    return { allowed: false, reason: "Email consent is not granted" }
  }
  if (channel === "SMS" && !contact.consentSms) {
    return { allowed: false, reason: "SMS consent is not granted" }
  }
  if (channel === "CALL" && !contact.consentCall) {
    return { allowed: false, reason: "Call consent is not granted" }
  }
  return { allowed: true }
}

const MERGE_KEYS = ["firstName", "lastName", "agentName"] as const

export type MergeVars = {
  firstName?: string
  lastName?: string
  agentName?: string
}

/** Only {{firstName}} {{lastName}} {{agentName}} — no arbitrary keys. */
export function renderTemplate(body: string, vars: MergeVars): string {
  let out = body
  for (const key of MERGE_KEYS) {
    const value = vars[key] ?? ""
    out = out.replaceAll(`{{${key}}}`, value)
  }
  return out
}
