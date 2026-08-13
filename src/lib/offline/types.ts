export type CompleteTaskPayload = {
  taskId: string
}

export type AddNotePayload = {
  contactId: string
  body: string
  subject?: string
}

export type OutboxType = "COMPLETE_TASK" | "ADD_NOTE"

export type OutboxStatus = "pending" | "syncing" | "failed" | "done"

export type OutboxItem = {
  id: string
  type: OutboxType
  payload: CompleteTaskPayload | AddNotePayload
  createdAt: string
  status: OutboxStatus
  error?: string
}

export type StashRecord<T = unknown> = {
  key: string
  data: T
  savedAt: string
}

export type StashedAgendaItem = {
  kind: "task" | "follow_up"
  id: string
  title: string
  score: number
  reasons: string[]
  dueAt: string | null
  contactId: string | null
  opportunityId: string | null
  priority?: string
}

export type StashedContactListItem = {
  id: string
  firstName: string
  lastName: string
  contactType: string
  lifecycleStage: string
  temperature: string | null
  email: string | null
  phone: string | null
}

export type StashedContactDetail = {
  id: string
  firstName: string
  lastName: string
  contactType: string
  lifecycleStage: string
  temperature: string | null
  source: string | null
  email: string | null
  phone: string | null
  notesSummary: string | null
  activities: Array<{
    id: string
    type: string
    subject: string | null
    body: string | null
    occurredAt: string
  }>
}

export const STASH_AGENDA = "agenda"
export const STASH_CONTACTS_LIST = "contactsList"

export function contactStashKey(id: string) {
  return `contact:${id}`
}
