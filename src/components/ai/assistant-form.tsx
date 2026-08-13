"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  askAssistantAction,
  confirmAssistantActionAction,
  createContactFactAction,
} from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

function kindClass(kind: Claim["kind"]) {
  switch (kind) {
    case "FACT":
      return "border-emerald-600/40 text-emerald-800 dark:text-emerald-300"
    case "CALCULATION":
      return "border-sky-600/40 text-sky-800 dark:text-sky-300"
    case "INFERENCE":
      return "border-amber-600/40 text-amber-800 dark:text-amber-300"
    default:
      return "border-muted-foreground/40 text-muted-foreground"
  }
}

export function AssistantForm({
  contacts,
  initialContactId,
}: {
  contacts: ContactOption[]
  initialContactId?: string
}) {
  const [question, setQuestion] = useState("")
  const [contactId, setContactId] = useState(initialContactId ?? "")
  const [result, setResult] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({})

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setActionStatus({})
    startTransition(async () => {
      try {
        const res = await askAssistantAction({
          question,
          contactId: contactId || null,
        })
        setResult(res)
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
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contactId">Optional contact scope</Label>
          <select
            id="contactId"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="flex h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">Entire organization (search + snapshot)</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="question">Question</Label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            required
            placeholder="e.g. What is this contact’s budget and next open task?"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
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
              <Badge variant="outline" className="border-amber-600/50 text-amber-800">
                Refused
                {result.response.refuseReason ? `: ${result.response.refuseReason}` : ""}
              </Badge>
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {result.response.answerMarkdown}
              </div>
            </CardContent>
          </Card>

          {result.response.claims.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Labeled claims</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.response.claims.map((c, i) => (
                  <div
                    key={`${i}-${c.text.slice(0, 24)}`}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <Badge variant="outline" className={cn(kindClass(c.kind))}>
                        {c.kind}
                      </Badge>
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
              </CardContent>
            </Card>
          ) : null}

          {proposed.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proposed actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                    <div key={action.id} className="space-y-2 rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{action.tool}</Badge>
                        <Badge
                          variant="outline"
                          className={
                            action.risk === "high"
                              ? "border-amber-600/50 text-amber-800"
                              : undefined
                          }
                        >
                          {action.risk === "high" ? "high risk" : "low risk"}
                        </Badge>
                      </div>
                      {action.rationale ? (
                        <p className="text-sm text-muted-foreground">{action.rationale}</p>
                      ) : null}
                      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                        {JSON.stringify(action.args, null, 2)}
                      </pre>
                      {status.message ? (
                        <p
                          className={cn(
                            "text-sm",
                            status.state === "error"
                              ? "text-destructive"
                              : status.state === "ok"
                                ? "text-emerald-700 dark:text-emerald-400"
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
              </CardContent>
            </Card>
          ) : null}

          {result.sources.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sources used</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {result.sources.map((s) => {
                    const href = sourceHref(s)
                    return (
                      <li key={`${s.type}-${s.id}`} className="flex gap-2">
                        <Badge variant="outline">{s.type}</Badge>
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
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
