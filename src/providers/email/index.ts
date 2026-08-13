export type EmailMessage = {
  to: string
  from: string
  subject: string
  html: string
  text?: string
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<{ id: string }>
}

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock"

  async send(): Promise<{ id: string }> {
    return { id: `mock-email-${Date.now()}` }
  }
}

/** Resend REST API — https://resend.com/docs/api-reference/emails/send-email */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend"

  constructor(
    private readonly apiKey: string,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Resend error ${res.status}: ${text}`)
    }
    const data = (await res.json()) as { id: string }
    return { id: data.id }
  }
}

export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY?.trim()
  if (key) return new ResendEmailProvider(key)
  return new MockEmailProvider()
}

export function getEmailFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "onboarding@resend.dev"
}
