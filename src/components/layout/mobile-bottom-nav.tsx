"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, CheckSquare, Contact, Home, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/app", label: "Home", icon: Home, match: (p: string) => p === "/app" },
  {
    href: "/app/inbox",
    label: "Inbox",
    icon: Inbox,
    match: (p: string) => p.startsWith("/app/inbox"),
  },
  {
    href: "/app/contacts",
    label: "Contacts",
    icon: Contact,
    match: (p: string) => p.startsWith("/app/contacts"),
  },
  {
    href: "/app/tasks",
    label: "Tasks",
    icon: CheckSquare,
    match: (p: string) => p.startsWith("/app/tasks"),
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: CalendarDays,
    match: (p: string) => p.startsWith("/app/calendar"),
  },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex h-14 max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tab.match(pathname)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "text-primary")} />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
