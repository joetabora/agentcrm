import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 rounded-xl border bg-card p-8 shadow-[var(--shadow-card)]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That route doesn’t exist in Joe Real Estate OS. Check the URL or head back home.
        </p>
      </div>
      <Link href="/app" className={cn(buttonVariants())}>
        Back to Home
      </Link>
    </div>
  )
}
