export type SmsMessage = {
  to: string
  from: string
  body: string
}

export interface SmsProvider {
  readonly name: string
  send(message: SmsMessage): Promise<{ id: string }>
}

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock"

  async send(): Promise<{ id: string }> {
    return { id: `mock-sms-${Date.now()}` }
  }
}

/** Twilio Messages API — https://www.twilio.com/docs/sms/api/message-resource */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio"

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
  ) {}

  async send(message: SmsMessage): Promise<{ id: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`
    const body = new URLSearchParams({
      To: message.to,
      From: message.from,
      Body: message.body,
    })
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Twilio error ${res.status}: ${text}`)
    }
    const data = (await res.json()) as { sid: string }
    return { id: data.sid }
  }
}

export function getSmsProvider(): SmsProvider {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (sid && token) return new TwilioSmsProvider(sid, token)
  return new MockSmsProvider()
}

export function getSmsFromNumber(): string {
  return process.env.TWILIO_FROM_NUMBER?.trim() || "+15555550100"
}
