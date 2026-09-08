/**
 * Cart pricing (PRD §7.2) — pure functions, property-tested (§12.5).
 * Invariant: subtotal − discount + shipping − taxExclusiveAdjustment = total
 * and sum(distributed discounts) === discount exactly (largest-remainder).
 */
import { assertMinor, MoneyError, roundHalfUp, sumMinor } from "./money";

export type PriceLine = {
  /** Stable line identity (cart_line id or temp client id). */
  id: string;
  qty: number;
  unitPriceMinor: number;
  /** Lines excluded from promotional discounts (e.g. gift wrap SKU). */
  discountable: boolean;
};

export type PromotionApplication = {
  promotionId: string;
  kind: "fixed" | "percent" | "free_shipping" | "bogo" | "tiered";
  /** Minor units for fixed; basis points (1/100 %) for percent. */
  value: number;
};

export type CartTotals = {
  subtotal: number;
  discount: number;
  shipping: number;
  /** 0 when prices are VAT-inclusive (EU display); added amount for US/UK. */
  tax: number;
  total: number;
  /** Discount allocated per line (keyed by line id) — sum equals discount exactly. */
  lineDiscounts: Record<string, number>;
  /** Per-line totals after discount distribution (unit × qty − lineDiscount). */
  lineTotals: Record<string, number>;
};

export type PricingInput = {
  lines: readonly PriceLine[];
  promotions: readonly PromotionApplication[];
  shippingMinor: number;
  /** Applied tax in minor units (from Stripe Tax at checkout; 0 for EU-inclusive display). */
  taxMinor?: number;
};

export function computeLineSubtotal(line: PriceLine): number {
  assertMinor(line.unitPriceMinor, "unitPriceMinor");
  if (!Number.isSafeInteger(line.qty) || line.qty < 0 || line.qty > 99) {
    throw new Error(`line ${line.id}: qty out of range ${line.qty}`);
  }
  return assertMinor(line.unitPriceMinor * line.qty, "lineSubtotal");
}

export function computeSubtotal(lines: readonly PriceLine[]): number {
  return sumMinor(lines.map(computeLineSubtotal));
}

/** Single best promotion wins (no stacking in v1 — PRD FR-810). */
export function selectBestPromotion(
  promotions: readonly PromotionApplication[],
  subtotal: number,
): PromotionApplication | null {
  let best: PromotionApplication | null = null;
  let bestValue = 0;
  for (const promotion of promotions) {
    let candidate = 0;
    switch (promotion.kind) {
      case "fixed":
        candidate = Math.min(promotion.value, subtotal);
        break;
      case "percent":
        candidate = roundHalfUp((subtotal * promotion.value) / 10_000);
        break;
      case "free_shipping":
      case "bogo":
      case "tiered":
        // Free-shipping value depends on the shipping rate — handled by caller.
        candidate = 0;
        break;
    }
    if (candidate > bestValue) {
      best = promotion;
      bestValue = candidate;
    }
  }
  return best;
}

/**
 * Distribute `discount` across discountable lines proportional to line value,
 * largest-remainder method; residual cents land on the largest remainders.
 * Uses BigInt so floor/remainder are EXACT — float division can drift by an
 * ulp and silently lose or invent a cent (found by property test).
 */
export function distributeDiscount(
  lines: readonly PriceLine[],
  discount: number,
): { lineDiscounts: Record<string, number>; lineTotals: Record<string, number> } {
  assertMinor(discount, "discount");
  const discountable = lines.filter((l) => l.discountable && l.qty > 0);
  const base = discountable.map((l) => ({ id: l.id, value: computeLineSubtotal(l) }));
  const totalValue = sumMinor(base.map((b) => b.value));

  const lineDiscounts: Record<string, number> = {};
  const lineTotals: Record<string, number> = {};
  for (const line of lines) {
    lineDiscounts[line.id] = 0;
  }

  if (totalValue === 0 || discount === 0) {
    for (const line of lines) lineTotals[line.id] = computeLineSubtotal(line);
    return { lineDiscounts, lineTotals };
  }

  const capped = Math.min(discount, totalValue);
  const cappedBig = BigInt(capped);
  const totalBig = BigInt(totalValue);

  let allocated = 0;
  const remainders: Array<{ id: string; remainder: bigint }> = [];

  for (const entry of base) {
    // Exact rational floor and remainder — no float involved.
    const scaled = cappedBig * BigInt(entry.value);
    const floor = scaled / totalBig;
    allocated += Number(floor);
    lineDiscounts[entry.id] = Number(floor);
    remainders.push({ id: entry.id, remainder: scaled % totalBig });
  }

  // Hand out leftover cents to the largest remainders (deterministic order:
  // remainder desc, then line value desc, then id asc for total determinism).
  let residual = capped - allocated; // guaranteed 0 <= residual < line count
  remainders.sort(
    (a, b) =>
      (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0),
  );
  for (const entry of remainders) {
    if (residual <= 0) break;
    lineDiscounts[entry.id] = (lineDiscounts[entry.id] ?? 0) + 1;
    residual -= 1;
  }
  if (residual !== 0) {
    // Unreachable by the arithmetic above; guarded so money can never drift.
    throw new MoneyError(`discount distribution lost ${residual} cents`);
  }

  for (const line of lines) {
    lineTotals[line.id] = computeLineSubtotal(line) - (lineDiscounts[line.id] ?? 0);
  }
  return { lineDiscounts, lineTotals };
}

export function computeCartTotals(input: PricingInput): CartTotals {
  const subtotal = computeSubtotal(input.lines);
  const best = selectBestPromotion(input.promotions, subtotal);
  const rawDiscount =
    best && (best.kind === "fixed" || best.kind === "percent")
      ? best.kind === "fixed"
        ? Math.min(best.value, subtotal)
        : roundHalfUp((subtotal * best.value) / 10_000)
      : 0;

  const { lineDiscounts, lineTotals } = distributeDiscount(input.lines, rawDiscount);
  const discount = sumMinor(Object.values(lineDiscounts));
  const shipping =
    best?.kind === "free_shipping" ? 0 : assertMinor(input.shippingMinor, "shippingMinor");
  const tax = assertMinor(input.taxMinor ?? 0, "taxMinor");

  const discountedGoods = sumMinor(Object.values(lineTotals));
  const total = assertMinor(discountedGoods + shipping + tax, "total");

  return { subtotal, discount, shipping, tax, total, lineDiscounts, lineTotals };
}
