/**
 * Search term expansion (round 7, R7-4; FR-105; PAD R-SHOP-1): the pure seam
 * between the `search_synonym` table and the FTS query builders. The seeded
 * couch→sofa rows were dead data before this slice — never queried anywhere.
 * Pure so the expansion semantics are pinned by unit tests without a DB.
 */

export interface SearchSynonymRow {
  term: string;
  synonym: string;
}

/**
 * Expand a raw user query with synonym terms. The first element is always
 * the trimmed query itself; matching synonym rows (case-insensitive on the
 * term, matched per whitespace token) append their synonym exactly once.
 * Synonyms already contained in the query are not re-added.
 */
export function expandSearchTerms(query: string, synonyms: SearchSynonymRow[]): string[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [trimmed];

  const tokens = new Set(trimmed.split(/\s+/).map((token) => token.toLowerCase()));
  const seen = new Set(tokens);
  const expansions: string[] = [];

  for (const { term, synonym } of synonyms) {
    if (!term || !synonym) continue;
    const termLower = term.toLowerCase();
    if (!tokens.has(termLower)) continue;
    const synonymLower = synonym.toLowerCase();
    if (seen.has(synonymLower)) continue;
    seen.add(synonymLower);
    expansions.push(synonym);
  }

  return [trimmed, ...expansions];
}
