export interface StorageProvider {
  readonly name: string
  putObject(key: string, body: Buffer, contentType: string): Promise<{ url: string }>
  getSignedUrl(key: string): Promise<string>
}

export class MockStorageProvider implements StorageProvider {
  readonly name = "mock"

  async putObject(key: string): Promise<{ url: string }> {
    return { url: `mock://storage/${key}` }
  }

  async getSignedUrl(key: string): Promise<string> {
    return `mock://storage/${key}?signed=1`
  }
}

export function getStorageProvider(): StorageProvider {
  return new MockStorageProvider()
}
