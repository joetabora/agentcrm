import Link from "next/link"
import { format } from "date-fns"
import { listThreads, getThread } from "@/domain/comms/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageShell, SectionHeader } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; channel?: string }>
}) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const channel =
    sp.channel === "EMAIL" || sp.channel === "SMS" ? sp.channel : undefined
  const threads = await listThreads(ctx.organization.id, { channel, take: 40 })
  const activeId = sp.thread ?? threads[0]?.id
  const active = activeId ? await getThread(ctx.organization.id, activeId) : null

  return (
    <PageShell
      title="Inbox"
      description="Email and SMS threads across your book of business."
      actions={
        <div className="flex gap-1">
          {[
            { label: "All", href: "/app/inbox" },
            { label: "Email", href: "/app/inbox?channel=EMAIL" },
            { label: "SMS", href: "/app/inbox?channel=SMS" },
          ].map((f) => (
            <Link
              key={f.label}
              href={f.href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                (f.label === "All" && !channel) ||
                  (f.label === "Email" && channel === "EMAIL") ||
                  (f.label === "SMS" && channel === "SMS")
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      }
    >
      {threads.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          description="Conversations appear here when you email or text contacts from the CRM."
          actionHref="/app/contacts"
          actionLabel="Open contacts"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr_280px]">
          <Card className="overflow-hidden shadow-[var(--shadow-card)]">
            <CardContent className="divide-y p-0">
              {threads.map((t) => {
                const preview = t.messages[0]
                const selected = t.id === active?.id
                return (
                  <Link
                    key={t.id}
                    href={`/app/inbox?thread=${t.id}${channel ? `&channel=${channel}` : ""}`}
                    className={cn(
                      "block px-3 py-3 transition-colors hover:bg-accent/50",
                      selected && "bg-accent",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {t.contact.firstName} {t.contact.lastName}
                      </p>
                      <StatusBadge tone="outline">{t.channel}</StatusBadge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {preview?.body ?? t.subject ?? "No messages yet"}
                    </p>
                    {t.lastMessageAt ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {format(t.lastMessageAt, "MMM d, h:mm a")}
                      </p>
                    ) : null}
                  </Link>
                )
              })}
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="space-y-4 p-4">
              {active ? (
                <>
                  <div>
                    <h2 className="text-base font-semibold">
                      {active.contact.firstName} {active.contact.lastName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {active.channel}
                      {active.subject ? ` · ${active.subject}` : ""}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {active.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                          m.direction === "OUTBOUND"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            m.direction === "OUTBOUND"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {format(m.createdAt, "MMM d, h:mm a")} · {m.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a thread.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="space-y-3 p-4">
              <SectionHeader title="Contact" />
              {active ? (
                <>
                  <p className="text-sm font-medium">
                    {active.contact.firstName} {active.contact.lastName}
                  </p>
                  <StatusBadge>{active.contact.contactType}</StatusBadge>
                  <Link
                    href={`/app/contacts/${active.contact.id}`}
                    className="inline-flex text-sm font-medium text-primary hover:underline"
                  >
                    Open contact
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No contact selected.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  )
}
