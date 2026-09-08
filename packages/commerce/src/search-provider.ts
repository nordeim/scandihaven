/**
 * Postgres FTS binding of the SearchProvider port (PRD v4 §4.8, ADR-6).
 * Delegates to the catalog typeahead query (title FTS + ILIKE fallback) and
 * enforces the route contract's result cap. The managed-search swap target
 * (Algolia/Meilisearch) replaces this file without touching call sites.
 */
import { searchTypeahead } from "./catalog";
import type { SearchProvider, SearchQuery, SearchResult } from "./providers";

export const TYPEAHEAD_MAX_LIMIT = 10;

export function createPostgresSearchProvider(deps: {
  typeahead?: typeof searchTypeahead;
} = {}): SearchProvider {
  const typeahead = deps.typeahead ?? searchTypeahead;

  return {
    async search(query: SearchQuery): Promise<SearchResult> {
      const q = query.q.trim();
      if (q.length === 0) {
        throw new Error("Search query must not be empty.");
      }
      const limit = Math.min(Math.max(query.limit ?? 8, 1), TYPEAHEAD_MAX_LIMIT);
      const rows = await typeahead(q, limit);
      return {
        hits: rows.map((row) => ({
          slug: row.slug,
          title: row.title,
          kind: "product",
        })),
        nextCursor: null,
      };
    },
  };
}
