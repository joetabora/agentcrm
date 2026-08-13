import { AppShell } from "@/components/layout/app-shell"
import { requireOrgContext } from "@/server/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext()

  return (
    <AppShell orgName={ctx.organization.name} userName={ctx.user.name}>
      {children}
    </AppShell>
  )
}
