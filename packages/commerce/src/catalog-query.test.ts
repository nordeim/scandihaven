import { describe, expect, it } from "vitest";

import { productQuerySchema } from "./catalog";

/**
 * Audit 2026-09-09 M-COL: the collection detail page needs to fetch its
 * members at the DB level (validated uuid ID list) instead of loading the
 * first 48 products and filtering in JavaScript — the JS path silently drops
 * collection members beyond the sort window.
 */
describe("productQuerySchema ids filter (M-COL)", () => {
  const validUuid = "10000000-0000-4000-8000-000000000001";

  it("accepts an optional list of product ids", () => {
    const parsed = productQuerySchema.parse({ ids: [validUuid] });
    expect(parsed.ids).toEqual([validUuid]);
  });

  it("defaults to undefined when ids are absent", () => {
    const parsed = productQuerySchema.parse({});
    expect(parsed.ids).toBeUndefined();
  });

  it("rejects ids that are not uuids", () => {
    expect(() => productQuerySchema.parse({ ids: ["not-a-uuid"] })).toThrow();
  });

  it("rejects an ids list beyond the 500 bound", () => {
    const tooMany = Array.from({ length: 501 }, () => validUuid);
    expect(() => productQuerySchema.parse({ ids: tooMany })).toThrow();
  });

  it("rejects an ids list that is not an array of strings", () => {
    expect(() => productQuerySchema.parse({ ids: [42] })).toThrow();
  });
});
