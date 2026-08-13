import Link from "next/link"
import { signUpAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ERRORS: Record<string, string> = {
  missing_fields: "Name, email, and a password of at least 8 characters are required.",
  signup_failed: "Could not create account. Try signing in if you already registered.",
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorMessage = params.error ? ERRORS[params.error] ?? "Something went wrong." : null

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Your organization is created automatically on signup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <form action={signUpAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization / brokerage</Label>
              <Input id="organizationName" name="organizationName" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-foreground underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
