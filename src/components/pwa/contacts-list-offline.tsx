"use client"

import Link from "next/link"
import {
  EmptyState,
  SearchInput,
  StatusBadge,
  TemperatureBadge,
} from "@/components/patterns"
import { StaleBadge } from "@/components/pwa/offline-banner"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useOfflineStash, useOnline } from "@/lib/offline/hooks"
import { STASH_CONTACTS_LIST, type StashedContactListItem } from "@/lib/offline/types"
import { cn } from "@/lib/utils"

export function ContactsListOffline({
  contacts,
  searchQ,
}: {
  contacts: StashedContactListItem[]
  searchQ?: string
}) {
  const online = useOnline()
  const { data, savedAt, showingStash } = useOfflineStash(STASH_CONTACTS_LIST, contacts, online)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {showingStash ? <StaleBadge savedAt={savedAt} /> : null}
        {!online ? (
          <span className="text-xs text-muted-foreground">Search requires a connection.</span>
        ) : null}
      </div>

      {online ? (
        <form className="flex flex-wrap items-center gap-2">
          <SearchInput
            name="q"
            defaultValue={searchQ}
            placeholder="Search name, email, phone"
            className="min-w-[220px] flex-1"
          />
          <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Search
          </button>
        </form>
      ) : null}

      {data.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add your first contact to start building relationship history."
          actionHref="/app/contacts/new"
          actionLabel="Add contact"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Stage</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/app/contacts/${c.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone="outline">{c.contactType}</StatusBadge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {c.lifecycleStage}
                  </TableCell>
                  <TableCell>
                    <TemperatureBadge value={c.temperature} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {c.email ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {c.phone ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
