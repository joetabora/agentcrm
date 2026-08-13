export type EmailMessage = {
  to: string
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

export function getEmailProvider(): EmailProvider {
  return new MockEmailProvider()
}
