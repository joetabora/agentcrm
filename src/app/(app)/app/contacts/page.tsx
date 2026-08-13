import Link from "next/link"
import { listContacts } from "@/domain/contacts/service"
import { requireOrgContext } from "@/server/session"
import { PageHeader } from "@/components/crm/shared"
import { ContactsListOffline } from "@/components/pwa/contacts-list-offline"
import type { StashedContactListItem } from "@/lib/offline/types"

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

  const stashed: StashedContactListItem[] = contacts.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    contactType: c.contactType,
    lifecycleStage: c.lifecycleStage,
    temperature: c.temperature,
    email: c.emails.find((e) => e.isPrimary)?.email ?? c.emails[0]?.email ?? null,
    phone: c.phones.find((p) => p.isPrimary)?.phone ?? c.phones[0]?.phone ?? null,
  }))

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="People in your CRM"
        actions={
          <Link
            href="/app/contacts/new"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground md:h-8"
          >
            New contact
          </Link>
        }
      />

      <ContactsListOffline contacts={stashed} searchQ={params.q} />
    </div>
  )
}
