"use client"

import { useRouter } from "next/navigation"
import {
  Building2,
  CheckSquare,
  Contact,
  Kanban,
  Megaphone,
  Plus,
  Sparkles,
  Users,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import type { SearchResult } from "@/domain/search/service"

const quickActions = [
  { label: "New contact", href: "/app/contacts/new", icon: Contact },
  { label: "New lead", href: "/app/leads/new", icon: Users },
  { label: "New task", href: "/app/tasks", icon: CheckSquare },
  { label: "Add property", href: "/app/properties/new", icon: Building2 },
  { label: "Create campaign", href: "/app/campaigns", icon: Megaphone },
  { label: "Open pipeline", href: "/app/pipeline", icon: Kanban },
  { label: "Ask AI", href: "/app/assistant", icon: Sparkles },
] as const

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (value: string) => void
  results: SearchResult[]
  pending: boolean
}) {
  const router = useRouter()

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  const grouped = {
    contact: results.filter((r) => r.type === "contact"),
    opportunity: results.filter((r) => r.type === "opportunity"),
    property: results.filter((r) => r.type === "property"),
    task: results.filter((r) => r.type === "task"),
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandInput
        placeholder="Search or jump to an action…"
        value={query}
        onValueChange={onQueryChange}
      />
      <CommandList>
        <CommandEmpty>{pending ? "Searching…" : "No results found."}</CommandEmpty>
        <CommandGroup heading="Quick create">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <CommandItem key={action.href + action.label} onSelect={() => go(action.href)}>
                <Plus className="size-4 opacity-50" />
                <Icon className="size-4" />
                {action.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
        {grouped.contact.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contacts">
              {grouped.contact.map((r) => (
                <CommandItem key={r.id} onSelect={() => go(r.href)} value={`${r.title} ${r.subtitle}`}>
                  <Contact className="size-4" />
                  <span className="truncate">{r.title}</span>
                  {r.subtitle ? (
                    <span className="ml-auto text-xs text-muted-foreground">{r.subtitle}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {grouped.opportunity.length > 0 ? (
          <CommandGroup heading="Leads">
            {grouped.opportunity.map((r) => (
              <CommandItem key={r.id} onSelect={() => go(r.href)} value={`${r.title} ${r.subtitle}`}>
                <Users className="size-4" />
                <span className="truncate">{r.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {grouped.property.length > 0 ? (
          <CommandGroup heading="Properties">
            {grouped.property.map((r) => (
              <CommandItem key={r.id} onSelect={() => go(r.href)} value={`${r.title} ${r.subtitle}`}>
                <Building2 className="size-4" />
                <span className="truncate">{r.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {grouped.task.length > 0 ? (
          <CommandGroup heading="Tasks">
            {grouped.task.map((r) => (
              <CommandItem key={r.id} onSelect={() => go(r.href)} value={r.title}>
                <CheckSquare className="size-4" />
                <span className="truncate">{r.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {query.trim().length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={() => go(`/app/search?q=${encodeURIComponent(query)}`)}>
                View all results for “{query}”
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
