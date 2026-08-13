"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 rounded-xl border bg-card p-8 shadow-[var(--shadow-card)]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen hit an unexpected error. You can try again or return home.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link href="/app" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to Home
        </Link>
      </div>
    </div>
  )
}
