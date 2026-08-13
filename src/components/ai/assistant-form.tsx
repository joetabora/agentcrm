"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { askAssistantAction, createContactFactAction } from "@/app/actions"
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

type Source = {
  type: string
  id: string
  label: string
}

type AskResult = {
  response: {
    answerMarkdown: string
    claims: Claim[]
    refused?: boolean
    refuseReason?: string
  }
  sources: Source[]
  provider: string
  model: string
  contextEmpty: boolean
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
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
          {pending ? "Asking…" : "Ask assistant"}
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
                          <Link href={href} className="text-primary underline-offset-2 hover:underline">
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
