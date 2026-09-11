import { describe, expect, it } from "vitest";
import { expandSearchTerms } from "./search-terms";

/**
 * Search term expansion (round 7, R7-4 / FR-105 / PAD R-SHOP-1): the pure
 * seam between the `search_synonym` table and the FTS query builders. The
 * seeded couch→sofa row was dead data — never queried anywhere; this pins
 * the expansion semantics before the SQL wiring.
 */

describe("expandSearchTerms", () => {
  it("returns the trimmed query tokens when no synonyms match", () => {
    expect(expandSearchTerms("linen chair", [])).toEqual(["linen chair"]);
    expect(expandSearchTerms("  lamp  ", [])).toEqual(["lamp"]);
  });

  it("appends the synonym when a token matches a term (couch -> sofa)", () => {
    const rows = [{ term: "couch", synonym: "sofa" }];
    expect(expandSearchTerms("couch", rows)).toEqual(["couch", "sofa"]);
  });

  it("expansion is case-insensitive on both sides", () => {
    const rows = [{ term: "couch", synonym: "sofa" }];
    expect(expandSearchTerms("Couch", rows)).toEqual(["Couch", "sofa"]);
    expect(expandSearchTerms("COUCH", rows)).toEqual(["COUCH", "sofa"]);
  });

  it("expands multi-token queries per matching token", () => {
    const rows = [
      { term: "couch", synonym: "sofa" },
      { term: "lamp", synonym: "lighting" },
    ];
    expect(expandSearchTerms("couch lamp", rows)).toEqual(["couch lamp", "sofa", "lighting"]);
  });

  it("does not duplicate the query or a synonym already present", () => {
    const rows = [{ term: "sofa", synonym: "couch" }];
    // Query already contains the synonym target — no duplicate expansion.
    expect(expandSearchTerms("couch sofa", rows)).toEqual(["couch sofa"]);
  });

  it("keeps a single expansion per term even with duplicate rows", () => {
    const rows = [
      { term: "couch", synonym: "sofa" },
      { term: "couch", synonym: "sofa" },
    ];
    expect(expandSearchTerms("couch", rows)).toEqual(["couch", "sofa"]);
  });

  it("returns the bare query for empty input", () => {
    expect(expandSearchTerms("", [{ term: "couch", synonym: "sofa" }])).toEqual([""]);
    expect(expandSearchTerms("   ", [{ term: "couch", synonym: "sofa" }])).toEqual([""]);
  });
});
