export type EsignEnvelopeRequest = {
  documentName: string
  signers: { email: string; name: string }[]
}

export interface EsignProvider {
  readonly name: string
  createEnvelope(request: EsignEnvelopeRequest): Promise<{ id: string }>
}

export class MockEsignProvider implements EsignProvider {
  readonly name = "mock"

  async createEnvelope(_request: EsignEnvelopeRequest): Promise<{ id: string }> {
    return { id: `mock-esign-${Date.now()}` }
  }
}

export function getEsignProvider(): EsignProvider {
  return new MockEsignProvider()
}
