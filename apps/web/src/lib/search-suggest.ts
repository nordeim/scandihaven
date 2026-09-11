/**
 * Header search typeahead shaping (round 6, R6-2; PRD FR-104): the pure seam
 * between the typeahead route contract `{products, categories, journal}` and
 * the dropdown UI. Mirrors the route's 2-char minimum, caps total suggestions
 * so the dropdown stays a typeahead rather than a results page, and tolerates
 * malformed group payloads. Since round 7 (R7-2, FR-703) the journal group is
 * live — rows link to the `/journal/{category}/{slug}` reader route.
 */

export type SuggestionKind = "product" | "category" | "journal";

export type Suggestion = {
  kind: SuggestionKind;
  label: string;
  href: string;
};

export type SuggestionGroup = {
  label: string;
  items: Suggestion[];
};

/** Minimum query length the typeahead route accepts (§8.4 contract). */
export const TYPEAHEAD_MIN_CHARS = 2;

/** Group cap: the route serves at most 10 rows total (PRD §4.8). */
export const TYPEAHEAD_MAX_RESULTS = 10;

type UnknownRecord = Record<string, unknown>;

function asRecordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter((v): v is UnknownRecord => typeof v === "object" && v !== null) : [];
}

function readString(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

function groupFrom(
  kind: SuggestionKind,
  label: string,
  href: (slug: string, row: UnknownRecord) => string,
  rows: UnknownRecord[],
  remaining: number,
  sink: { count: number; groups: SuggestionGroup[] },
): void {
  if (remaining <= 0) return;
  const items: Suggestion[] = [];
  for (const row of rows) {
    if (sink.count >= remaining) break;
    const slug = readString(row, ["slug"]);
    if (!slug) continue;
    const name = readString(row, ["title", "name"]);
    if (!name) continue;
    items.push({ kind, label: name, href: href(slug, row) });
    sink.count += 1;
  }
  if (items.length > 0) sink.groups.push({ label, items });
}

/**
 * Shape a typeahead response into render-ready groups. Queries below the
 * 2-char route minimum (or whitespace-only) yield no groups; the total across
 * groups is capped at `limit`; malformed group payloads are skipped rather
 * than thrown on (the dropdown must never crash on contract drift).
 */
export function buildSuggestions(
  response: {
    products?: unknown;
    categories?: unknown;
    journal?: unknown;
  },
  limit: number = TYPEAHEAD_MAX_RESULTS,
): { groups: SuggestionGroup[]; total: number } {
  const query = typeof response === "object" && response !== null ? response : {};
  const cap = Math.max(0, Math.floor(limit));
  const sink = { count: 0, groups: [] as SuggestionGroup[] };

  groupFrom("product", "Products", (slug) => `/products/${slug}`, asRecordArray(query.products), cap, sink);
  groupFrom("category", "Collections", (slug) => `/shop/${slug}`, asRecordArray(query.categories), cap, sink);
  groupFrom(
    "journal",
    "Journal",
    (slug, row) => {
      // FR-703 reader routes are category-scoped (R7-2). Rows without a
      // category fall back to the flat path — the shaping stays tolerant of
      // contract drift (never crashes the dropdown).
      const category = readString(row, ["category"]);
      return category ? `/journal/${category}/${slug}` : `/journal/${slug}`;
    },
    asRecordArray(query.journal),
    cap,
    sink,
  );

  return { groups: sink.groups, total: sink.count };
}

/** True when the query has reached the route's minimum length. */
export function isTypeaheadReady(query: string): boolean {
  return query.trim().length >= TYPEAHEAD_MIN_CHARS;
}
