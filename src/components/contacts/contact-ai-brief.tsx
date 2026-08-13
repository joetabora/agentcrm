import Link from "next/link"
import { format } from "date-fns"
import { AIInsight } from "@/components/patterns"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Fact = { id: string; statement: string; confidence: string | number }
type Activity = { subject: string | null; type: string; occurredAt: Date }
type Task = { title: string }
type Opportunity = { nextAction: string | null }

export function ContactAiBrief({
  contactId,
  preferredName,
  firstName,
  lastName,
  contactType,
  motivation,
  notesSummary,
  facts,
  recentActivity,
  nextTask,
  nextOpportunityAction,
}: {
  contactId: string
  preferredName: string | null
  firstName: string
  lastName: string
  contactType: string
  motivation: string | null
  notesSummary: string | null
  facts: Fact[]
  recentActivity: Activity | undefined
  nextTask: Task | undefined
  nextOpportunityAction: Opportunity | undefined
}) {
  const wants =
    motivation || notesSummary || null
  const nextAction =
    nextTask?.title ||
    nextOpportunityAction?.nextAction ||
    null

  return (
    <AIInsight
      title="AI Brief"
      subtitle="From CRM fields only"
      body={
        <div className="space-y-3">
          <p>
            Deterministic summary from stored CRM data. For grounded Q&amp;A, use the assistant.
          </p>
          <div>
            <p className="font-medium text-foreground">Who is this?</p>
            <p>
              {preferredName || firstName} {lastName} ·{" "}
              {contactType.replaceAll("_", " ").toLowerCase()}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">What do they want?</p>
            <p>
              {wants ??
                "No brief data yet — no motivation or notes summary stored for this contact."}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Stored facts</p>
            {facts.length === 0 ? (
              <p>
                No ContactFact records yet. Confirm suggestions from the Assistant to save facts.
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {facts.map((f) => (
                  <li key={f.id}>
                    · {f.statement}{" "}
                    <span className="text-xs">({f.confidence})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">What happened recently?</p>
            <p>
              {recentActivity
                ? `${recentActivity.subject ?? recentActivity.type} · ${format(recentActivity.occurredAt, "MMM d")}`
                : "No recent activity."}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">What should I do next?</p>
            <p>
              {nextAction ??
                "Create a task or opportunity to define the next action."}
            </p>
          </div>
        </div>
      }
      actions={
        <Link
          href={`/app/assistant?contactId=${contactId}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Ask about this contact
        </Link>
      }
    />
  )
}
