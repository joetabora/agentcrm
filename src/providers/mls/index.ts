export type MlsListingQuery = {
  mlsNumber?: string
  postalCode?: string
}

export type MlsListing = {
  mlsNumber: string
  address: string
  listPrice?: number
  status?: string
  source: string
}

export interface MlsProvider {
  readonly name: string
  searchListings(query: MlsListingQuery): Promise<MlsListing[]>
}

/** Development stub. Production requires authorized MLS/brokerage credentials. */
export class MockMlsProvider implements MlsProvider {
  readonly name = "mock"

  async searchListings(): Promise<MlsListing[]> {
    return []
  }
}

export function getMlsProvider(): MlsProvider {
  return new MockMlsProvider()
}
