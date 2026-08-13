"use client"

import Link from "next/link"
import { EmptyState, TemperatureBadge } from "@/components/crm/shared"
import { StaleBadge } from "@/components/pwa/offline-banner"
import { Badge } from "@/components/ui/badge"
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
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {showingStash ? <StaleBadge savedAt={savedAt} /> : null}
        {!online ? (
          <span className="text-xs text-muted-foreground">Search requires a connection.</span>
        ) : null}
      </div>

      {online ? (
        <form className="mb-4 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={searchQ}
            placeholder="Search name, email, phone"
            className="h-10 min-w-[220px] flex-1 rounded-lg border bg-background px-3 text-sm md:h-8"
          />
          <button type="submit" className="h-10 rounded-lg border px-3 text-sm md:h-8">
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
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/app/contacts/${c.id}`} className="font-medium hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.contactType}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.lifecycleStage}</TableCell>
                  <TableCell>
                    <TemperatureBadge value={c.temperature as never} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
