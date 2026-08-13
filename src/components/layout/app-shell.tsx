"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Contact,
  Home,
  Inbox,
  Kanban,
  Megaphone,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  CircleHelp,
} from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { signOutAction } from "@/app/actions"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { CommandPalette } from "@/components/layout/command-palette"
import { OfflineBanner } from "@/components/pwa/offline-banner"
import { OfflineSyncBootstrap } from "@/components/pwa/offline-sync-bootstrap"
import { SyncQueueIndicator } from "@/components/pwa/sync-queue-indicator"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { globalSearchAction } from "@/app/search-actions"
import type { SearchResult } from "@/domain/search/service"

const primaryNav = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/contacts", label: "Contacts", icon: Contact },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/app/properties", label: "Properties", icon: Building2 },
  { href: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/transactions", label: "Transactions", icon: Briefcase },
  { href: "/app/campaigns", label: "Marketing", icon: Megaphone },
  { href: "/app/assistant", label: "AI", icon: Sparkles },
  { href: "/app/reports", label: "Reports", icon: BarChart3 },
] as const

const secondaryNav = [
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/help", label: "Help", icon: CircleHelp },
] as const

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app"
  if (href === "/app/settings") return pathname.startsWith("/app/settings")
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        {primaryNav.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          )
        })}
      </div>
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border pt-3">
        {secondaryNav.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function ThemeToggleItem() {
  const { theme, setTheme } = useTheme()
  const next = theme === "dark" ? "light" : "dark"
  return (
    <DropdownMenuItem onClick={() => setTheme(next)}>
      {next === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      {next === "dark" ? "Dark mode" : "Light mode"}
    </DropdownMenuItem>
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("joe-re-os-sidebar-collapsed") === "1"
  })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    window.localStorage.setItem("joe-re-os-sidebar-collapsed", collapsed ? "1" : "0")
  }, [collapsed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function runSearch(value: string) {
    setQuery(value)
    startTransition(async () => {
      const next = await globalSearchAction(value)
      setResults(next)
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineSyncBootstrap />
      <OfflineBanner />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        query={query}
        onQueryChange={runSearch}
        results={results}
        pending={pending}
      />
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 md:flex",
            collapsed ? "w-[68px]" : "w-60",
          )}
        >
          <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Home className="size-4" />
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">Joe RE OS</p>
                <p className="truncate text-xs text-muted-foreground">{orgName}</p>
              </div>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <NavLinks collapsed={collapsed} />
          </div>
          <div className="border-t border-sidebar-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
              {!collapsed ? <span className="ml-1">Collapse</span> : null}
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-2.5 backdrop-blur md:px-4">
            <div className="flex items-center gap-2 md:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger
                  render={
                    <Button variant="outline" size="icon" className="size-9" aria-label="Open menu">
                      <Menu className="size-4" />
                    </Button>
                  }
                />
                <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                  <SheetHeader className="border-b border-sidebar-border p-4 text-left">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <div className="p-2">
                    <NavLinks onNavigate={() => setOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
              <span className="text-sm font-semibold">Joe RE OS</span>
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50 md:flex lg:max-w-md"
            >
              <Search className="size-4 shrink-0" />
              <span className="truncate">Search contacts, properties, leads…</span>
              <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-1.5">
              <SyncQueueIndicator />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 md:hidden"
                aria-label="Search"
                onClick={() => setPaletteOpen(true)}
              >
                <Search className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="icon" className="size-9" aria-label="Quick create">
                      <Plus className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Create</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/app/contacts/new")}>
                    New contact
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/leads/new")}>
                    New lead
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/tasks")}>New task</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/properties/new")}>
                    Add property
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/campaigns")}>
                    Create campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/assistant")}>
                    Ask AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Open AI"
                onClick={() => router.push("/app/assistant")}
              >
                <Sparkles className="size-4 text-ai" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="size-9" aria-label="Account menu">
                      <Avatar size="sm">
                        <AvatarFallback>{initials || "JR"}</AvatarFallback>
                      </Avatar>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="truncate font-medium">{userName}</span>
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        {orgName}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ThemeToggleItem />
                  <DropdownMenuItem onClick={() => router.push("/app/settings")}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/app/help")}>Help</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      void signOutAction()
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  )
}
