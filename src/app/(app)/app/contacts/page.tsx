import Link from "next/link"
import { listContacts } from "@/domain/contacts/service"
import { requireOrgContext } from "@/server/session"
import { EmptyState, PageHeader, TemperatureBadge } from "@/components/crm/shared"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>
}) {
  const ctx = await requireOrgContext()
  const params = await searchParams
  const contacts = await listContacts(ctx.organization.id, {
    q: params.q,
    contactType: params.type as never,
  })

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="People in your CRM"
        actions={
          <Link
            href="/app/contacts/new"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
          >
            New contact
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search name, email, phone"
          className="h-8 min-w-[220px] flex-1 rounded-lg border bg-background px-3 text-sm"
        />
        <button type="submit" className="h-8 rounded-lg border px-3 text-sm">
          Search
        </button>
      </form>

      {contacts.length === 0 ? (
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
              {contacts.map((c) => (
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
                    <TemperatureBadge value={c.temperature} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.emails.find((e) => e.isPrimary)?.email ?? c.emails[0]?.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phones.find((p) => p.isPrimary)?.phone ?? c.phones[0]?.phone ?? "—"}
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
