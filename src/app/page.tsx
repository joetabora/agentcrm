import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/server/session"
import { Button } from "@/components/ui/button"

export default async function HomePage() {
  const session = await getSession()
  if (session?.user) redirect("/app")

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">Joe Real Estate OS</p>
      <h1 className="text-4xl font-semibold tracking-tight">
        The CRM that works for the agent
      </h1>
      <p className="max-w-xl text-muted-foreground">
        Contacts, pipeline, tasks, and next-best-action foundations — built for production
        real-estate workflows.
      </p>
      <div className="flex gap-3">
        <Button render={<Link href="/sign-up" />}>Create account</Button>
        <Button variant="outline" render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </div>
    </main>
  )
}
