"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  askAssistantAction,
  confirmAssistantActionAction,
  createContactFactAction,
} from "@/app/actions"
import { AIBadge, AIInsight, NativeSelect, NativeTextarea, StatusBadge } from "@/components/patterns"
import { AssistantSessionList } from "@/components/ai/assistant-session-list"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ContactOption = { id: string; label: string }

type Claim = {
  text: string
  kind: "FACT" | "CALCULATION" | "INFERENCE" | "UNKNOWN"
  sourceIds?: string[]
}

type ProposedAction = {
  id: string
  tool: string
  args: Record<string, unknown>
  rationale: string
  risk?: "low" | "high"
}

type Source = {
  type: string
  id: string
  label: string
}

type AskResult = {
  response: {
    answerMarkdown: string
    claims: Claim[]
    proposedActions: ProposedAction[]
    refused?: boolean
    refuseReason?: string
  }
  sources: Source[]
  provider: string
  model: string
  contextEmpty: boolean
}

type ActionStatus = {
  state: "idle" | "pending" | "ok" | "error" | "dismissed"
  message?: string
}

function sourceHref(s: Source): string | null {
  switch (s.type) {
    case "contact":
      return `/app/contacts/${s.id}`
    case "opportunity":
      return `/app/leads/${s.id}`
    case "property":
      return `/app/properties/${s.id}`
    case "task":
      return `/app/tasks`
    default:
      return null
  }
}

function kindTone(kind: Claim["kind"]): "success" | "info" | "warning" | "default" | "ai" {
  switch (kind) {
    case "FACT":
      return "success"
    case "CALCULATION":
      return "info"
    case "INFERENCE":
      return "warning"
    default:
      return "ai"
  }
}

export function AssistantForm({
  contacts,
  initialContactId,
  providerName,
}: {
  contacts: ContactOption[]
  initialContactId?: string
  providerName?: string
}) {
  const [question, setQuestion] = useState("")
  const [contactId, setContactId] = useState(initialContactId ?? "")
  const [result, setResult] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({})
  const [sessionLatest, setSessionLatest] = useState<string | null>(null)

  const selectedContact = contacts.find((c) => c.id === contactId)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setActionStatus({})
    const q = question.trim()
    startTransition(async () => {
      try {
        const res = await askAssistantAction({
          question: q,
          contactId: contactId || null,
        })
        setResult(res)
        setSessionLatest(q)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ask failed")
      }
    })
  }

  function dismissAction(id: string) {
    setActionStatus((prev) => ({
      ...prev,
      [id]: { state: "dismissed", message: "Dismissed" },
    }))
  }

  function confirmAction(action: ProposedAction) {
    setActionStatus((prev) => ({
      ...prev,
      [action.id]: { state: "pending" },
    }))
    startTransition(async () => {
      try {
        const res = await confirmAssistantActionAction({
          tool: action.tool,
          args: action.args,
        })
        if (res.ok) {
          setActionStatus((prev) => ({
            ...prev,
            [action.id]: { state: "ok", message: res.message },
          }))
        } else {
          setActionStatus((prev) => ({
            ...prev,
            [action.id]: { state: "error", message: res.error },
          }))
        }
      } catch (err) {
        setActionStatus((prev) => ({
          ...prev,
          [action.id]: {
            state: "error",
            message: err instanceof Error ? err.message : "Confirm failed",
          },
        }))
      }
    })
  }

  const proposed = result?.response.proposedActions ?? []

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
      <aside className="order-2 min-h-[200px] lg:order-1 lg:min-h-[420px]">
        <AssistantSessionList
          latestQuestion={sessionLatest}
          onSelect={(q) => setQuestion(q)}
        />
      </aside>

      <div className="order-1 space-y-4 lg:order-2">
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-xl border border-ai/20 bg-ai-surface/40 p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-2">
            <AIBadge />
            <span className="text-xs text-muted-foreground">
              {providerName ? `Provider: ${providerName}` : "Grounded CRM Q&A"}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactId">Optional contact scope</Label>
            <NativeSelect
              id="contactId"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">Entire organization (search + snapshot)</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="question">Question</Label>
            <NativeTextarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              required
              placeholder="e.g. What is this contact’s budget and next open task?"
            />
          </div>
          <Button type="submit" disabled={pending || !question.trim()}>
            {pending ? "Working…" : "Ask assistant"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>

        {result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Provider: <strong className="text-foreground">{result.provider}</strong>
              </span>
              <span>·</span>
              <span>
                Model: <strong className="text-foreground">{result.model}</strong>
              </span>
              {result.response.refused ? (
                <StatusBadge tone="warning">
                  Refused
                  {result.response.refuseReason ? `: ${result.response.refuseReason}` : ""}
                </StatusBadge>
              ) : null}
            </div>

            <AIInsight
              title="Answer"
              body={
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {result.response.answerMarkdown}
                </div>
              }
            />

            {result.response.claims.length > 0 ? (
              <div className="space-y-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-medium">Labeled claims</h3>
                {result.response.claims.map((c, i) => (
                  <div
                    key={`${i}-${c.text.slice(0, 24)}`}
                    className="flex flex-col gap-2 rounded-lg border border-ai/15 bg-ai-surface/30 p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <StatusBadge tone={kindTone(c.kind)}>{c.kind}</StatusBadge>
                      <p className="text-sm">{c.text}</p>
                    </div>
                    {contactId && (c.kind === "INFERENCE" || c.kind === "FACT") ? (
                      <form action={createContactFactAction}>
                        <input type="hidden" name="contactId" value={contactId} />
                        <input type="hidden" name="statement" value={c.text} />
                        <input type="hidden" name="fromAi" value="1" />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={`/app/contacts/${contactId}`}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Save as ContactFact
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {proposed.length > 0 ? (
              <div className="space-y-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-medium">Proposed actions</h3>
                <p className="text-xs text-muted-foreground">
                  Nothing runs until you confirm. High-risk actions (email, SMS, stage, enroll)
                  always need explicit approval.
                </p>
                {proposed.map((action) => {
                  const status = actionStatus[action.id] ?? { state: "idle" as const }
                  const done =
                    status.state === "ok" ||
                    status.state === "error" ||
                    status.state === "dismissed"
                  return (
                    <div
                      key={action.id}
                      className="space-y-2 rounded-lg border border-ai/15 bg-ai-surface/20 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="ai">{action.tool}</StatusBadge>
                        <StatusBadge tone={action.risk === "high" ? "warning" : "outline"}>
                          {action.risk === "high" ? "high risk" : "low risk"}
                        </StatusBadge>
                      </div>
                      {action.rationale ? (
                        <p className="text-sm text-muted-foreground">{action.rationale}</p>
                      ) : null}
                      <pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs">
                        {JSON.stringify(action.args, null, 2)}
                      </pre>
                      {status.message ? (
                        <p
                          className={cn(
                            "text-sm",
                            status.state === "error"
                              ? "text-destructive"
                              : status.state === "ok"
                                ? "text-success"
                                : "text-muted-foreground",
                          )}
                        >
                          {status.message}
                        </p>
                      ) : null}
                      {!done ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending || status.state === "pending"}
                            onClick={() => confirmAction(action)}
                          >
                            {status.state === "pending" ? "Confirming…" : "Confirm"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending || status.state === "pending"}
                            onClick={() => dismissAction(action.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {result.sources.length > 0 ? (
              <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
                <h3 className="mb-2 text-sm font-medium">Sources used</h3>
                <ul className="space-y-1 text-sm">
                  {result.sources.map((s) => {
                    const href = sourceHref(s)
                    return (
                      <li key={`${s.type}-${s.id}`} className="flex gap-2">
                        <StatusBadge tone="outline">{s.type}</StatusBadge>
                        {href ? (
                          <Link
                            href={href}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {s.label}
                          </Link>
                        ) : (
                          <span>{s.label}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="order-3 space-y-3">
        <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Context
          </h3>
          {selectedContact ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">{selectedContact.label}</p>
              <Link
                href={`/app/contacts/${selectedContact.id}`}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Open contact
              </Link>
              <p className="text-xs text-muted-foreground">
                Answers prefer facts, tasks, and activities linked to this contact.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No contact scoped. The assistant searches org-wide CRM snapshots.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-ai/20 bg-ai-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <AIBadge />
            <span className="text-xs font-medium text-ai">Tips</span>
          </div>
          <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
            <li>Ask about budget, stage, open tasks, or last touch.</li>
            <li>Proposed actions never run until you confirm.</li>
            <li>Save solid FACT / INFERENCE claims as ContactFacts.</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
