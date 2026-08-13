import Link from "next/link"
import type { ReactNode } from "react"

const links = [
  { href: "/app/settings", label: "Overview" },
  { href: "/app/settings/routing", label: "Routing" },
  { href: "/app/settings/workflows", label: "Workflows" },
  { href: "/app/settings/templates", label: "Templates" },
  { href: "/app/settings/mls", label: "MLS" },
] as const

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Settings">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
