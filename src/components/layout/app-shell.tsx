"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  CheckSquare,
  Contact,
  FileText,
  Home,
  Kanban,
  LayoutDashboard,
  Megaphone,
  Menu,
  Route,
  Search,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/app/actions"

const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/contacts", label: "Contacts", icon: Contact },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/app/properties", label: "Properties", icon: Building2 },
  { href: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/assistant", label: "Assistant", icon: Sparkles },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/app/settings/routing", label: "Routing", icon: Route },
  { href: "/app/settings/workflows", label: "Workflows", icon: Workflow },
  { href: "/app/settings/templates", label: "Templates", icon: FileText },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active =
          item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({
  orgName,
  userName,
  children,
}: {
  orgName: string
  userName: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-4">
            <Home className="size-5 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Joe Real Estate OS</p>
              <p className="truncate text-xs text-muted-foreground">{orgName}</p>
            </div>
          </div>
          <div className="flex-1 p-3">
            <NavLinks />
          </div>
          <div className="border-t p-3">
            <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{userName}</p>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <Home className="size-5" />
              <span className="text-sm font-semibold">Joe RE OS</span>
            </div>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon">
                    <Menu className="size-4" />
                  </Button>
                }
              />
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b p-4 text-left">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
