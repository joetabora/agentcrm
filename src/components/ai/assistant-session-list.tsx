"use client"

import { useEffect, useRef, useState } from "react"
import { SectionHeader } from "@/components/patterns"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "harbor-assistant-session-questions"

type SessionItem = {
  id: string
  question: string
  at: number
}

function readStored(): SessionItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionItem[]
    return Array.isArray(parsed) ? parsed.slice(0, 40) : []
  } catch {
    return []
  }
}

export function AssistantSessionList({
  latestQuestion,
  onSelect,
}: {
  latestQuestion?: string | null
  onSelect?: (question: string) => void
}) {
  const [items, setItems] = useState<SessionItem[]>(readStored)
  const lastHandled = useRef<string | null>(null)

  useEffect(() => {
    const q = latestQuestion?.trim()
    if (!q || q === lastHandled.current) return
    lastHandled.current = q
    const id = window.setTimeout(() => {
      setItems((prev) => {
        const next: SessionItem[] = [
          { id: `${Date.now()}`, question: q, at: Date.now() },
          ...prev.filter((p) => p.question !== q),
        ].slice(0, 40)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* quota */
        }
        return next
      })
    }, 0)
    return () => window.clearTimeout(id)
  }, [latestQuestion])

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card shadow-[var(--shadow-card)]">
      <div className="border-b px-3 py-3">
        <SectionHeader title="This session" className="mb-0" />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Past questions in this browser only — not saved to the CRM.
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y">
        {items.length === 0 ? (
          <li className="px-3 py-4 text-xs text-muted-foreground">
            Ask a question to start a local history.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect?.(item.question)}
                className={cn(
                  "w-full px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent/50",
                )}
              >
                <span className="line-clamp-2 text-foreground">{item.question}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
