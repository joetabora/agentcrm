import { processDueEnrollments } from "@/domain/workflows/engine"
import { processDueCampaignEnrollments } from "@/domain/campaigns/engine"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [workflows, campaigns] = await Promise.all([
    processDueEnrollments(),
    processDueCampaignEnrollments(),
  ])
  return NextResponse.json({ ok: true, workflows, campaigns })
}
