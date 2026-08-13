import { listContacts } from "@/domain/contacts/service"
import { getAIProvider } from "@/providers/ai"
import { requireOrgContext } from "@/server/session"
import { PageHeader } from "@/components/crm/shared"
import { AssistantForm } from "@/components/ai/assistant-form"

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string }>
}) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const contacts = await listContacts(ctx.organization.id)
  const provider = getAIProvider()

  return (
    <div>
      <PageHeader
        title="Assistant"
        description={`Grounded Q&A over your org CRM data. Provider: ${provider.name}. Proposed actions never run until you confirm.`}
      />
      <AssistantForm
        contacts={contacts.map((c) => ({
          id: c.id,
          label: `${c.firstName} ${c.lastName}`,
        }))}
        initialContactId={sp.contactId}
      />
    </div>
  )
}
