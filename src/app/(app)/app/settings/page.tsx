import Link from "next/link"
import { requireOrgContext } from "@/server/session"
import { PageShell } from "@/components/patterns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const sections = [
  {
    href: "/app/settings/routing",
    title: "Routing",
    description: "Lead assignment rules and round-robin settings.",
  },
  {
    href: "/app/settings/workflows",
    title: "Workflows",
    description: "Automations that enroll contacts and opportunities.",
  },
  {
    href: "/app/settings/templates",
    title: "Templates",
    description: "Email and SMS message templates with merge fields.",
  },
  {
    href: "/app/settings/mls",
    title: "MLS",
    description: "Authorized listing sync and attribution settings.",
  },
] as const

export default async function SettingsHubPage() {
  await requireOrgContext()

  return (
    <PageShell
      title="Settings"
      description="Organization configuration for routing, workflows, templates, and MLS."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full shadow-[var(--shadow-card)] transition-colors group-hover:border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
