import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import type { Membership, Organization, User } from "@/generated/prisma/client"

export type OrgContext = {
  user: User
  organization: Organization
  membership: Membership
}

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  })
}

export async function requireSession() {
  const session = await getSession()
  if (!session?.user) {
    redirect("/sign-in")
  }
  return session
}

export async function requireOrgContext(): Promise<OrgContext> {
  const session = await requireSession()
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: true,
      user: true,
    },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  return {
    user: membership.user,
    organization: membership.organization,
    membership,
  }
}
