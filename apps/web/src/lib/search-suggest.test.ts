import { describe, expect, it } from "vitest";
import { buildSuggestions } from "./search-suggest";

/**
 * Header search typeahead shaping (round 6, R6-2; PRD FR-104): the pure seam
 * between the typeahead route contract `{products, categories, journal}` and
 * the dropdown UI. The route already Zod-validates the wire shape; this helper
 * normalizes, caps results across groups, and
 * keeps the dropdown a typeahead, not a results page.
 */

describe("buildSuggestions", () => {
  it("returns no groups for an empty response (sub-minimum queries route here)", () => {
    const result = buildSuggestions({ products: [], categories: [], journal: [] }, 10);
    expect(result.groups).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("groups product hits with links and a searchable label", () => {
    const result = buildSuggestions(
      {
        products: [
          { slug: "oresund-table-lamp", title: "Øresund Table Lamp" },
          { slug: "halden-linen-armchair", title: "Halden Linen Armchair" },
        ],
        categories: [],
        journal: [],
      },
      10,
    );
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.label).toMatch(/products/i);
    expect(result.groups[0]?.items).toEqual([
      { kind: "product", label: "Øresund Table Lamp", href: "/products/oresund-table-lamp" },
      { kind: "product", label: "Halden Linen Armchair", href: "/products/halden-linen-armchair" },
    ]);
    expect(result.total).toBe(2);
  });

  it("caps total suggestions at the given limit across groups", () => {
    const result = buildSuggestions(
      {
        products: Array.from({ length: 8 }, (_, i) => ({
          slug: `p-${i}`,
          title: `Product ${i}`,
        })),
        categories: [{ slug: "lighting", title: "Lighting" }],
        journal: [{ slug: "craft-notes", title: "Craft Notes" }],
      },
      5,
    );
    expect(result.total).toBe(5);
    expect(result.groups[0]?.items).toHaveLength(5);
  });

  it("passes through malformed group payloads without throwing (client contract)", () => {
    const result = buildSuggestions(
      {
        products: "not-an-array",
        categories: undefined,
        journal: null,
      } as unknown as Parameters<typeof buildSuggestions>[0],
      10,
    );
    expect(result.groups).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("keeps category and journal entries as navigation links", () => {
    const result = buildSuggestions(
      {
        products: [],
        categories: [{ slug: "lighting", title: "Lighting" }],
        journal: [{ slug: "oak-and-linen", category: "craft", title: "Oak & Linen" }],
      },
      10,
    );
    expect(result.groups.map((g) => g.label).sort()).toEqual(["Collections", "Journal"]);
    const all = result.groups.flatMap((g) => g.items);
    expect(all).toContainEqual({ kind: "category", label: "Lighting", href: "/shop/lighting" });
    // Journal links are category-scoped to the FR-703 reader route (R7-2)
    expect(all).toContainEqual({
      kind: "journal",
      label: "Oak & Linen",
      href: "/journal/craft/oak-and-linen",
    });
  });

  it("falls back to a category-less journal href when the row lacks a category (contract tolerance)", () => {
    const result = buildSuggestions(
      { products: [], categories: [], journal: [{ slug: "legacy-post", title: "Legacy Post" }] },
      10,
    );
    const journalItem = result.groups[0]?.items[0];
    expect(journalItem?.href).toBe("/journal/legacy-post");
  });
});
