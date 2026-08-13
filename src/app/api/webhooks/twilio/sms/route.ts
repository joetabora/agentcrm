import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { handleInboundSms, isSmsStopBody } from "@/domain/comms/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function validateTwilioSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("")
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64")
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Twilio SMS webhook (STOP / inbound).
 * Configure in Twilio console: POST {APP_URL}/api/webhooks/twilio/sms
 * Optional query: ?organizationId=... (required to map tenant)
 */
export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const form = await request.formData()
  const params: Record<string, string> = {}
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v
  })

  const url = new URL(request.url)
  const organizationId =
    url.searchParams.get("organizationId") || process.env.TWILIO_DEFAULT_ORG_ID || ""

  if (authToken) {
    const signature = request.headers.get("x-twilio-signature")
    const publicUrl =
      process.env.TWILIO_WEBHOOK_URL?.trim() ||
      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${url.pathname}${url.search}`
    if (!validateTwilioSignature(authToken, signature, publicUrl, params)) {
      return new NextResponse("Invalid signature", { status: 403 })
    }
  }

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) return NextResponse.json({ error: "Unknown organization" }, { status: 404 })

  const from = params.From ?? ""
  const body = params.Body ?? ""
  const sid = params.MessageSid

  const result = await handleInboundSms({
    organizationId,
    fromPhone: from,
    body,
    providerMessageId: sid,
  })

  // Empty TwiML — acknowledge receipt
  const twiml = isSmsStopBody(body)
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You are unsubscribed from SMS. Reply START only if you re-consent out of band.</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
      "X-Matched-Contact": result.matched ? "1" : "0",
    },
  })
}
