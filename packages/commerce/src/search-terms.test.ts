import { describe, expect, it } from "vitest";
import { expandSearchTerms } from "./search-terms";

/**
 * Search term expansion (round 7, R7-4 / FR-105 / PAD R-SHOP-1): the pure
 * seam between the `search_synonym` table and the FTS query builders. The
 * seeded couch→sofa row was dead data — never queried anywhere; this pins
 * the expansion semantics before the SQL wiring.
 *
 * Round 10 (R10-3): the return is structured `{ original, synonyms }` — the
 * builders scope synonym terms to TITLES (description-verb false positives
 * otherwise leaked: "lamp" → throw, "rug" → lamp). These tests pin the same
 * expansion semantics as round 7 in the new shape.
 */

describe("expandSearchTerms", () => {
  it("returns the trimmed query with no synonyms when none match", () => {
    expect(expandSearchTerms("linen chair", [])).toEqual({ original: "linen chair", synonyms: [] });
    expect(expandSearchTerms("  lamp  ", [])).toEqual({ original: "lamp", synonyms: [] });
  });

  it("appends the synonym when a token matches a term (couch -> sofa)", () => {
    const rows = [{ term: "couch", synonym: "sofa" }];
    expect(expandSearchTerms("couch", rows)).toEqual({ original: "couch", synonyms: ["sofa"] });
  });

  it("expansion is case-insensitive on both sides", () => {
    const rows = [{ term: "couch", synonym: "sofa" }];
    expect(expandSearchTerms("Couch", rows)).toEqual({ original: "Couch", synonyms: ["sofa"] });
    expect(expandSearchTerms("COUCH", rows)).toEqual({ original: "COUCH", synonyms: ["sofa"] });
  });

  it("expands multi-token queries per matching token", () => {
    const rows = [
      { term: "couch", synonym: "sofa" },
      { term: "lamp", synonym: "lighting" },
    ];
    expect(expandSearchTerms("couch lamp", rows)).toEqual({
      original: "couch lamp",
      synonyms: ["sofa", "lighting"],
    });
  });

  it("does not duplicate the query or a synonym already present", () => {
    const rows = [{ term: "sofa", synonym: "couch" }];
    // Query already contains the synonym target — no duplicate expansion.
    expect(expandSearchTerms("couch sofa", rows)).toEqual({ original: "couch sofa", synonyms: [] });
  });

  it("keeps a single expansion per term even with duplicate rows", () => {
    const rows = [
      { term: "couch", synonym: "sofa" },
      { term: "couch", synonym: "sofa" },
    ];
    expect(expandSearchTerms("couch", rows)).toEqual({ original: "couch", synonyms: ["sofa"] });
  });

  it("returns the bare query for empty input", () => {
    expect(expandSearchTerms("", [{ term: "couch", synonym: "sofa" }])).toEqual({
      original: "",
      synonyms: [],
    });
    expect(expandSearchTerms("   ", [{ term: "couch", synonym: "sofa" }])).toEqual({
      original: "",
      synonyms: [],
    });
  });
});
