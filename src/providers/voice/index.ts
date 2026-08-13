export type VoiceCallRequest = {
  to: string
  from?: string
}

export interface VoiceProvider {
  readonly name: string
  initiateCall(request: VoiceCallRequest): Promise<{ id: string }>
}

export class MockVoiceProvider implements VoiceProvider {
  readonly name = "mock"

  async initiateCall(): Promise<{ id: string }> {
    return { id: `mock-call-${Date.now()}` }
  }
}

export function getVoiceProvider(): VoiceProvider {
  return new MockVoiceProvider()
}
