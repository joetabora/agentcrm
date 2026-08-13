export type SmsMessage = {
  to: string
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

export function getSmsProvider(): SmsProvider {
  return new MockSmsProvider()
}
