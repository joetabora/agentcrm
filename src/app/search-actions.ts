"use server"

import { requireOrgContext } from "@/server/session"
import { globalSearch, type SearchResult } from "@/domain/search/service"

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const ctx = await requireOrgContext()
  return globalSearch(ctx.organization.id, query, 12)
}
