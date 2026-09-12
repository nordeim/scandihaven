/**
 * Search term expansion (round 7, R7-4; FR-105; PAD R-SHOP-1): the pure seam
 * between the `search_synonym` table and the FTS query builders. The seeded
 * couch→sofa rows were dead data before this slice — never queried anywhere.
 * Pure so the expansion semantics are pinned by unit tests without a DB.
 *
 * Round 10 (R10-3): the return is STRUCTURED — `{ original, synonyms }` —
 * because the query builders now treat the two classes differently: the
 * original query keeps the full search contract (maintained A/B-weighted
 * `search_vector` + trigram + ILIKE), while synonym-EXPANDED terms match
 * TITLES only. Unscoped synonyms matched description text through the
 * B-weight vector ("lamp" surfaced the Hygge throw via "light enough to
 * sleep under"; "rug" surfaced the Øresund lamp via "throws a soft glow")
 * — description verbs are not product matches.
 */

export interface SearchSynonymRow {
  term: string;
  synonym: string;
}

export interface ExpandedSearchTerms {
  /** The trimmed query exactly as the customer typed it. */
  original: string;
  /** Synonym terms to match against product TITLES only (R10-3). */
  synonyms: string[];
}

/**
 * Expand a raw user query with synonym terms. `original` is always the
 * trimmed query itself; matching synonym rows (case-insensitive on the
 * term, matched per whitespace token) append their synonym exactly once.
 * Synonyms already contained in the query are not re-added.
 */
export function expandSearchTerms(query: string, synonyms: SearchSynonymRow[]): ExpandedSearchTerms {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { original: trimmed, synonyms: [] };

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

  return { original: trimmed, synonyms: expansions };
}
