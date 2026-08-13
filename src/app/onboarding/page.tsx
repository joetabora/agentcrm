import { createOrgAction } from "@/app/actions"
import { requireSession } from "@/server/session"
import { getMembershipForUser } from "@/domain/orgs/service"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function OnboardingPage() {
  const session = await requireSession()
  const membership = await getMembershipForUser(session.user.id)
  if (membership) redirect("/app")

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>Multi-tenant CRM starts with an organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOrgAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" name="name" required defaultValue={`${session.user.name}'s Realty`} />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
