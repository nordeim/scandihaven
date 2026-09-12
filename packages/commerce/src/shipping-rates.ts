/**
 * Rates-table shipping adapter (PRD FR-402/507; live E2E audit 2026-09-12
 * round 9, R9-3): the first ShippingRateProvider implementation. Resolves the
 * destination zone by country, selects the weight-banded rows, and enforces
 * the white-glove rule above 30 kg (the port contract, FR-409/507).
 *
 * The cart-page estimate is DISPLAY-ONLY: it never mutates cart totals
 * (`shippingMinor` stays null; placement keeps `shippingMinor: 0` — the
 * documented goods-only launch decision). Quote amounts are denominated in
 * the ZONE's native currency (seeded EUR/USD/GBP per zone); Phase 1 is
 * EUR-only, so no FX conversion is attempted here.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { cart, cartLine, productVariant, shippingRate, shippingZone, variantPrice } from "@scandihaven/db/schema";
import { CartError } from "./cart-service";
import type { ShippingQuote, ShippingQuoteInput, ShippingRateProvider, ShippingMethod } from "./providers";

/** White-glove is force-selected above 30 kg (port contract, FR-409/507). */
const WHITE_GLOVE_FORCE_WEIGHT_G = 30_000;

/** Methods offered without forcing, in display order. */
const BANDED_METHODS: readonly ShippingMethod[] = ["standard", "express", "pickup"] as const;

export function createRatesTableShippingProvider(): ShippingRateProvider {
  return {
    async quote(input: ShippingQuoteInput): Promise<ShippingQuote[]> {
      // Zone resolution is by COUNTRY (zones carry explicit country arrays).
      // The input's region/currency stay advisory — they drive checkout-time
      // FX decisions, not the estimate lookup. Ordered by name so a future
      // overlapping zone stays deterministic.
      const zones = await db
        .select({ id: shippingZone.id })
        .from(shippingZone)
        .where(and(eq(shippingZone.isActive, true), sql`${input.country} = ANY(${shippingZone.countries})`))
        .orderBy(asc(shippingZone.name))
        .limit(1);
      const zoneId = zones[0]?.id;
      if (!zoneId) return [];

      const rates = await db.select().from(shippingRate).where(eq(shippingRate.zoneId, zoneId));

      // White-glove forcing: above the threshold the ONLY offered method is
      // the forced white-glove quote — lighter methods must not tempt a
      // 30 kg+ order into an impossible shipment.
      if (input.weightG > WHITE_GLOVE_FORCE_WEIGHT_G) {
        const forced = rates.find((r) => r.method === "white_glove");
        return forced
          ? [
              {
                method: "white_glove" as const,
                amountMinor: forced.amount,
                etaDaysMin: forced.etaDaysMin,
                etaDaysMax: forced.etaDaysMax,
                forced: true,
              },
            ]
          : [];
      }

      // Weight-banded methods: the cheapest row per method whose band covers
      // the cart weight (bands are half-open [min, max] with max null = ∞).
      // Pickup is weight-independent in the seed (band 0..∞, amount 0).
      const quotes: ShippingQuote[] = [];
      for (const method of BANDED_METHODS) {
        const candidates = rates
          .filter(
            (r) =>
              r.method === method &&
              r.minWeightG <= input.weightG &&
              (r.maxWeightG === null || input.weightG <= r.maxWeightG),
          )
          .sort((a, b) => a.amount - b.amount);
        const best = candidates[0];
        if (best) {
          quotes.push({
            method,
            amountMinor: best.amount,
            etaDaysMin: best.etaDaysMin,
            etaDaysMax: best.etaDaysMax,
          });
        }
      }
      return quotes;
    },
  };
}

/** Estimate result crossing the RSC → client boundary (FR-402 display-only). */
export type ShippingEstimate = {
  quotes: ShippingQuote[];
  /** Zone-native currency the quote amounts are denominated in. */
  currency: string;
  /** Cart weight rollup the banding used (grams). */
  weightG: number;
};

/**
 * Estimate shipping for a cart (FR-402): roll up the cart's variant weights,
 * then quote through the rates-table provider for the given destination.
 * `postalCode` is part of the provider contract (carrier rating APIs at the
 * swap trigger will need it); the seeded table resolves by country.
 */
export async function estimateShippingForCart(
  cartId: string,
  input: { country: string; postalCode: string },
): Promise<ShippingEstimate> {
  const cartRows = await db.select().from(cart).where(eq(cart.id, cartId)).limit(1);
  const cartRow = cartRows[0];
  if (!cartRow) throw new CartError("Cart not found", "NOT_FOUND");

  // Weight + subtotal rollup. A missing weight counts as 0 g (the lowest
  // band) — the seed populates every variant, and charging a heavier band
  // for UNKNOWN weight would be the dishonest direction. Price falls back to
  // the line snapshot exactly like getCartDto's unit-price seam.
  const lineRows = await db
    .select({
      qty: cartLine.qty,
      weightG: productVariant.weightG,
      unitPrice: variantPrice.amount,
      snapshot: cartLine.unitPriceSnapshot,
    })
    .from(cartLine)
    .innerJoin(productVariant, eq(productVariant.id, cartLine.variantId))
    .leftJoin(
      variantPrice,
      and(eq(variantPrice.variantId, cartLine.variantId), eq(variantPrice.currency, cartRow.currency)),
    )
    .where(eq(cartLine.cartId, cartId));

  const weightG = lineRows.reduce((acc, r) => acc + (r.weightG ?? 0) * r.qty, 0);
  const subtotalMinor = lineRows.reduce((acc, r) => acc + (r.unitPrice ?? r.snapshot) * r.qty, 0);

  const quotes = await createRatesTableShippingProvider().quote({
    postalCode: input.postalCode,
    country: input.country,
    region: cartRow.region,
    currency: cartRow.currency,
    weightG,
    subtotalMinor,
  });

  // The zone's rates share a native currency in the seed; derive it from the
  // selected rows rather than a second query.
  const zoneRates =
    quotes.length > 0
      ? await db
          .select({ currency: shippingRate.currency })
          .from(shippingRate)
          .innerJoin(shippingZone, eq(shippingZone.id, shippingRate.zoneId))
          .where(and(eq(shippingZone.isActive, true), sql`${input.country} = ANY(${shippingZone.countries})`))
          .limit(1)
      : [];
  const currency = zoneRates[0]?.currency ?? cartRow.currency;

  return { quotes, currency, weightG };
}
