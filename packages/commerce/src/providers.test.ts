import { describe, expect, it, vi } from "vitest";
import {
  createLocalConsentProvider,
  type ConsentCategory,
  type ConsentProvider,
  type EmailProvider,
  type JobRunner,
  type ShippingRateProvider,
  type TaxProvider,
} from "./providers";
import { createPostgresSearchProvider } from "./search-provider";

describe("local consent provider (PRD v4 §4.8: ConsentProvider port)", () => {
  it("defaults to necessary-only consent", () => {
    const consent = createLocalConsentProvider();
    expect(consent.load()).toEqual({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  });

  it("has() reflects granted categories", () => {
    const consent = createLocalConsentProvider();
    expect(consent.has("necessary")).toBe(true);
    expect(consent.has("analytics")).toBe(false);
    consent.grant("analytics");
    expect(consent.has("analytics")).toBe(true);
  });

  it("revoke() removes a granted category but never necessary", () => {
    const consent = createLocalConsentProvider();
    consent.grant("marketing");
    expect(consent.has("marketing")).toBe(true);
    consent.revoke("marketing");
    expect(consent.has("marketing")).toBe(false);
    expect(() => {
      consent.revoke("necessary");
    }).toThrow(/necessary/);
  });

  it("onChange notifies listeners and supports unsubscribe", () => {
    const consent = createLocalConsentProvider();
    const listener = vi.fn();
    const unsubscribe = consent.onChange(listener);
    consent.grant("functional");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ functional: true }),
    );
    unsubscribe();
    consent.revoke("functional");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("honors seeded initial state for restored persistence", () => {
    const consent: ConsentProvider = createLocalConsentProvider({
      analytics: true,
      marketing: true,
    });
    expect(consent.has("analytics")).toBe(true);
    expect(consent.has("marketing")).toBe(true);
    expect(consent.has("functional")).toBe(false);
  });

  it("every ConsentCategory is covered by the state shape", () => {
    const categories: ConsentCategory[] = [
      "necessary",
      "functional",
      "analytics",
      "marketing",
    ];
    const consent = createLocalConsentProvider();
    for (const category of categories) {
      expect(typeof consent.has(category)).toBe("boolean");
    }
  });
});

describe("postgres search provider (PRD v4 §4.8: SearchProvider port)", () => {
  const fakeTypeahead = vi.fn(async (q: string, limit?: number) =>
    q === "halden"
      ? [
          { slug: "halden-armchair", title: "Halden Armchair" },
          { slug: "halden-sofa", title: "Halden Sofa" },
        ].slice(0, limit ?? 8)
      : [],
  );

  it("delegates to the typeahead function and shapes hits", async () => {
    const provider = createPostgresSearchProvider({ typeahead: fakeTypeahead });
    const result = await provider.search({ q: "halden" });
    expect(fakeTypeahead).toHaveBeenCalledWith("halden", 8);
    expect(result.hits).toEqual([
      { slug: "halden-armchair", title: "Halden Armchair", kind: "product" },
      { slug: "halden-sofa", title: "Halden Sofa", kind: "product" },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it("caps limit at 10 (route contract §8.4 limit≤10)", async () => {
    const provider = createPostgresSearchProvider({ typeahead: fakeTypeahead });
    await provider.search({ q: "halden", limit: 500 });
    expect(fakeTypeahead).toHaveBeenLastCalledWith("halden", 10);
  });

  it("rejects empty queries before hitting the provider", async () => {
    const provider = createPostgresSearchProvider({ typeahead: fakeTypeahead });
    await expect(provider.search({ q: "   " })).rejects.toThrow(/query/i);
    expect(fakeTypeahead).not.toHaveBeenCalledWith("", expect.anything());
  });
});

describe("provider ports are implementable (v3a §6.3 contract)", () => {
  it("EmailProvider accepts the documented message shape", async () => {
    const fake: EmailProvider = {
      send: async (message) => {
        expect(message.template).toBe("order-confirmation");
        expect(typeof message.to).toBe("string");
        return { transport: "log", id: null };
      },
    };
    await expect(
      fake.send({ template: "order-confirmation", to: "a@b.dk", data: {} }),
    ).resolves.toEqual({ transport: "log", id: null });
  });

  it("TaxProvider quote covers lines + destination + inclusive flag", async () => {
    const fake: TaxProvider = {
      quote: async (input) => {
        expect(input.address.country).toBe("DK");
        expect(input.taxInclusive).toBe(true);
        return { taxMinor: 0, inclusive: true, breakdown: [] };
      },
    };
    await fake.quote({
      lines: [{ id: "l1", unitPriceMinor: 129900, qty: 1 }],
      address: { postalCode: "9000", country: "DK", region: "EU" },
      currency: "EUR",
      taxInclusive: true,
    });
  });

  it("ShippingRateProvider quote returns quotes incl. white_glove forcing", async () => {
    const fake: ShippingRateProvider = {
      quote: async (input) => {
        expect(input.weightG).toBeGreaterThan(30_000);
        return [
          { method: "white_glove", amountMinor: 49_000, etaDaysMin: 3, etaDaysMax: 7, forced: true },
        ];
      },
    };
    const quotes = await fake.quote({
      postalCode: "9000",
      country: "DK",
      region: "EU",
      currency: "EUR",
      weightG: 42_000,
      subtotalMinor: 129_900,
    });
    expect(quotes[0]?.method).toBe("white_glove");
  });

  it("JobRunner exposes enqueue + drain", async () => {
    const fake: JobRunner = {
      enqueue: async (spec) => {
        expect(spec.kind).toBe("email.order_confirmation");
      },
      drain: async () => ({ processed: 1, failed: 0, dead: 0 }),
    };
    await fake.enqueue({
      kind: "email.order_confirmation",
      payload: { orderNumber: "SH-2026-000001" },
      dedupeKey: "email:order:SH-2026-000001",
    });
    await expect(fake.drain({ limit: 5 })).resolves.toEqual({
      processed: 1,
      failed: 0,
      dead: 0,
    });
  });
});
