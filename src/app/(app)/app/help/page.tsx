import Link from "next/link"
import { requireOrgContext } from "@/server/session"
import { PageShell, SectionHeader } from "@/components/patterns"
import { Card, CardContent } from "@/components/ui/card"

export default async function HelpPage() {
  await requireOrgContext()

  return (
    <PageShell title="Help" description="Shortcuts, definitions, and where to look next.">
      <section>
        <SectionHeader title="Keyboard" />
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="space-y-2 p-4 text-sm">
            <p>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd> /{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl K</kbd> — Command
              palette (search + quick create)
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Reporting definitions" />
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>
              Conversion, response time, GCI, and source yield are available in{" "}
              <Link href="/app/reports" className="font-medium text-primary hover:underline">
                Reports
              </Link>
              .
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Closed % uses current stage key CLOSED — not historical path-through.</li>
              <li>
                Response time starts at opportunity create and ends at first outbound EMAIL/SMS/CALL.
              </li>
              <li>GCI never comes from estimated value — only CLOSED transactions.</li>
              <li>ROI requires entered spend; otherwise you see yield only.</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Common destinations" />
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["/app", "Home"],
            ["/app/inbox", "Inbox"],
            ["/app/contacts", "Contacts"],
            ["/app/calendar", "Calendar"],
            ["/app/assistant", "AI"],
            ["/app/settings", "Settings"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border bg-card px-3 py-2 text-sm font-medium shadow-[var(--shadow-card)] hover:border-primary/30"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  )
}
