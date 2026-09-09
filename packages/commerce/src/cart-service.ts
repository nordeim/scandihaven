/** Cart service (PRD §7.4, FR-401..406) — server-side cart keyed by signed cookie token. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import {
  cart,
  cartLine,
  cartPromotion,
  inventoryLevel,
  media,
  product,
  productVariant,
  promotion,
  variantImage,
  variantPrice,
} from "@scandihaven/db/schema";
import type { CartDto, CartLineDto } from "./dto";
import { computeCartTotals, type PriceLine } from "./pricing";
import { evaluatePromotion, filterEligiblePromotions, humanizePromotionRejection, type PromotionInput } from "./promotions";
import { createRequestDedupe } from "./request-dedupe";

/**
 * Idempotency for addLine (PRD §8.3): the same (cart, requestId) pair within
 * 5 minutes is a no-op that returns the current cart — double-taps and
 * optimistic-retries cannot double-add. Per-instance scope (see request-dedupe).
 */
const addLineDedupe = createRequestDedupe(5 * 60_000);

const CART_COOKIE = "sh_cart";

/**
 * Cart-cookie HMAC secret (PRD FR-403): BETTER_AUTH_SECRET, ≥ 32 chars.
 * Read per call, never snapshotted at import, and there is NO insecure
 * fallback — a missing/short secret fails fast here instead of silently
 * minting forgeable cart identities (CLAUDE.md env contract: "required or
 * boot fails").
 */
function cartSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing or shorter than 32 chars — cart cookies cannot be signed safely. Generate one with `openssl rand -base64 32`.",
    );
  }
  return secret;
}

export class CartError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "VALIDATION" | "NOT_PURCHASABLE",
  ) {
    super(message);
  }
}

/** Signed cart token: `<random>.<hmac>` — tamper-evident (PRD FR-403). */
export function createCartToken(): string {
  const value = randomBytes(24).toString("hex");
  const sig = createHmac("sha256", cartSecret()).update(value).digest("hex").slice(0, 32);
  return `${value}.${sig}`;
}

export function verifyCartToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [value, sig] = token.split(".");
  if (!value || !sig) return null;
  const expected = createHmac("sha256", cartSecret()).update(value).digest("hex").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? token : null;
}

export const CART_COOKIE_NAME = CART_COOKIE;

/** Get or create the cart for a token; returns the cart id. */
export async function ensureCart(token: string, userId?: string | null): Promise<string> {
  const existing = await db.select().from(cart).where(eq(cart.token, token)).limit(1);
  if (existing[0]) {
    if (userId && !existing[0].userId) {
      // Attach guest cart to the user on login (FR-403).
      await db.update(cart).set({ userId, updatedAt: new Date() }).where(eq(cart.id, existing[0].id));
    }
    return existing[0].id;
  }
  const created = await db
    .insert(cart)
    .values({ token, userId: userId ?? null, region: "EU", currency: "EUR" })
    .returning({ id: cart.id });
  const id = created[0]!.id;
  return id;
}

/**
 * Merge a guest cart into the user's most recent active cart (FR-403).
 * Wiring note: no auth databaseHooks call site exists yet — the Better-Auth
 * sign-in hook that invokes this is a queued remediation slice (FR-403,
 * docs/plans/2026-09-08-remediation-plan.md B5) because hook-scope cookie
 * access needs runtime verification. Guest carts currently attach only when
 * the same signed token is reused via ensureCart(token, userId).
 */
export async function mergeGuestCartIntoUserCart(guestCartId: string, userId: string): Promise<void> {
  const target = await db
    .select()
    .from(cart)
    .where(and(eq(cart.userId, userId), eq(cart.status, "active")))
    .limit(1);
  if (target.length === 0 || target[0]!.id === guestCartId) return;
  const targetId = target[0]!.id;

  const guestLines = await db.select().from(cartLine).where(eq(cartLine.cartId, guestCartId));
  for (const line of guestLines) {
    const existing = await db
      .select()
      .from(cartLine)
      .where(
        and(
          eq(cartLine.cartId, targetId),
          eq(cartLine.variantId, line.variantId),
          eq(cartLine.isGiftWrap, line.isGiftWrap),
        ),
      )
      .limit(1);
    if (existing[0]) {
      const mergedQty = Math.min(99, existing[0].qty + line.qty);
      await db.update(cartLine).set({ qty: mergedQty }).where(eq(cartLine.id, existing[0].id));
    } else {
      await db.insert(cartLine).values({ ...line, id: undefined, cartId: targetId });
    }
  }
  await db
    .update(cart)
    .set({ status: "merged", userId, updatedAt: new Date() })
    .where(eq(cart.id, guestCartId));
}

async function loadVariantPricing(variantId: string) {
  const rows = await db
    .select({
      variant: productVariant,
      product: product,
      amount: variantPrice.amount,
      compareAt: variantPrice.compareAt,
      available: inventoryLevel.qtyOnHand,
      reserved: inventoryLevel.qtyReserved,
      safety: inventoryLevel.safetyStock,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .innerJoin(
      variantPrice,
      and(eq(variantPrice.variantId, productVariant.id), eq(variantPrice.currency, "EUR")),
    )
    .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, productVariant.id))
    .where(eq(productVariant.id, variantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function addLine(
  cartId: string,
  variantId: string,
  qty: number,
  requestId?: string,
): Promise<CartDto> {
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
    throw new CartError("Quantity must be between 1 and 99", "VALIDATION");
  }
  if (requestId !== undefined && !addLineDedupe.checkAndReserve(`${cartId}:${requestId}`)) {
    return getCartDto(cartId);
  }
  const pricing = await loadVariantPricing(variantId);
  if (!pricing) throw new CartError("Variant not found", "NOT_FOUND");
  if (pricing.product.status !== "active") {
    throw new CartError("Product is not purchasable", "NOT_PURCHASABLE");
  }
  const available =
    pricing.available === null
      ? null
      : pricing.available - (pricing.reserved ?? 0) - (pricing.safety ?? 0);
  const madeToOrder = available === null || (available <= 0 && pricing.product.leadTimeDaysMax > 7);
  if (!madeToOrder && (available === null || available <= 0)) {
    throw new CartError("This variant is currently out of stock", "NOT_PURCHASABLE");
  }

  const existing = await db
    .select()
    .from(cartLine)
    .where(and(eq(cartLine.cartId, cartId), eq(cartLine.variantId, variantId)))
    .limit(1);

  if (existing[0]) {
    const nextQty = Math.min(99, existing[0].qty + qty);
    await db
      .update(cartLine)
      .set({ qty: nextQty, unitPriceSnapshot: pricing.amount, updatedAt: new Date() })
      .where(eq(cartLine.id, existing[0].id));
  } else {
    await db.insert(cartLine).values({
      cartId,
      variantId,
      qty,
      unitPriceSnapshot: pricing.amount,
    });
  }
  await db.update(cart).set({ updatedAt: new Date() }).where(eq(cart.id, cartId));
  return getCartDto(cartId);
}

export async function updateLineQty(cartId: string, lineId: string, qty: number): Promise<CartDto> {
  if (qty === 0) return removeLine(cartId, lineId);
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
    throw new CartError("Quantity must be between 1 and 99", "VALIDATION");
  }
  const result = await db
    .update(cartLine)
    .set({ qty, updatedAt: new Date() })
    .where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)))
    .returning({ id: cartLine.id });
  if (!result[0]) throw new CartError("Cart line not found", "NOT_FOUND");
  return getCartDto(cartId);
}

export async function removeLine(cartId: string, lineId: string): Promise<CartDto> {
  await db.delete(cartLine).where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)));
  return getCartDto(cartId);
}

async function loadPromotions(cartId: string): Promise<{ inputs: PromotionInput[]; rows: { id: string; code: string | null }[] }> {
  const joins = await db
    .select({ promotion })
    .from(cartPromotion)
    .innerJoin(promotion, eq(promotion.id, cartPromotion.promotionId))
    .where(eq(cartPromotion.cartId, cartId));
  return {
    rows: joins.map((j) => ({ id: j.promotion.id, code: j.promotion.code })),
    inputs: joins.map((j) => ({
      id: j.promotion.id,
      code: j.promotion.code,
      kind: j.promotion.kind,
      value: j.promotion.value,
      tiers: null,
      conditions: (j.promotion.conditionsJson ?? {}) as PromotionInput["conditions"],
      startsAt: j.promotion.startsAt,
      endsAt: j.promotion.endsAt,
      usageLimit: j.promotion.usageLimit,
      perCustomerLimit: j.promotion.perCustomerLimit,
      usageCount: 0,
      perCustomerUsed: 0,
    })),
  };
}

export async function applyPromotionByCode(cartId: string, code: string): Promise<CartDto> {
  const rows = await db
    .select()
    .from(promotion)
    .where(eq(promotion.code, code.trim().toLowerCase()))
    .limit(1);
  const promo = rows[0];
  if (!promo || !promo.isActive) throw new CartError("Promotion code not found", "NOT_FOUND");

  const dto = await getCartDto(cartId);
  const evaluation = evaluatePromotion(
    {
      id: promo.id,
      code: promo.code,
      kind: promo.kind,
      value: promo.value,
      tiers: null,
      conditions: (promo.conditionsJson ?? {}) as PromotionInput["conditions"],
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
      usageLimit: promo.usageLimit,
      perCustomerLimit: promo.perCustomerLimit,
      usageCount: 0,
      perCustomerUsed: 0,
    },
    {
      subtotalMinor: dto.subtotalMinor,
      region: dto.region,
      now: new Date(),
      productIds: dto.lines.map((l) => l.variantId),
      categoryIds: [],
      isGuest: true,
    },
  );
  if (!evaluation.eligible) {
    // Customer copy, not the raw reason code (audit 2026-09-09 round 2, M1-PROMO).
    throw new CartError(humanizePromotionRejection(evaluation.reason), "VALIDATION");
  }
  await db.delete(cartPromotion).where(eq(cartPromotion.cartId, cartId));
  await db.insert(cartPromotion).values({ cartId, promotionId: promo.id });
  return getCartDto(cartId);
}

export async function getCartDto(cartId: string): Promise<CartDto> {
  const cartRows = await db.select().from(cart).where(eq(cart.id, cartId)).limit(1);
  const cartRow = cartRows[0];
  if (!cartRow) throw new CartError("Cart not found", "NOT_FOUND");

  const lineRows = await db
    .select({
      line: cartLine,
      variant: productVariant,
      productSlug: product.slug,
      productTitle: product.title,
      unitPrice: variantPrice.amount,
      imageUrl: media.url,
      imageAlt: media.alt,
    })
    .from(cartLine)
    .innerJoin(productVariant, eq(productVariant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, productVariant.productId))
    .innerJoin(
      variantPrice,
      and(eq(variantPrice.variantId, cartLine.variantId), eq(variantPrice.currency, cartRow.currency)),
    )
    .leftJoin(variantImage, eq(variantImage.variantId, productVariant.id))
    .leftJoin(media, eq(media.id, variantImage.mediaId))
    .where(eq(cartLine.cartId, cartId));

  // Dedupe images per line (variant can have several).
  const seenImage = new Set<string>();
  const priceLines: PriceLine[] = [];
  const lines: CartLineDto[] = [];

  for (const row of lineRows) {
    const price = row.unitPrice ?? row.line.unitPriceSnapshot;
    const variantLabelParts = [row.variant.color, row.variant.material, row.variant.size].filter(
      Boolean,
    );
    if (!seenImage.has(row.line.id)) {
      seenImage.add(row.line.id);
      priceLines.push({
        id: row.line.id,
        qty: row.line.qty,
        unitPriceMinor: price,
        discountable: !row.line.isGiftWrap,
      });
      lines.push({
        id: row.line.id,
        variantId: row.variant.id,
        productSlug: row.productSlug,
        productTitle: row.productTitle,
        variantLabel: variantLabelParts.length > 0 ? variantLabelParts.join(" · ") : row.variant.sku,
        imageUrl: row.imageUrl ?? "/products/placeholder.svg",
        imageAlt: row.imageAlt ?? row.productTitle,
        qty: row.line.qty,
        unitPriceMinor: price,
        totalMinor: price * row.line.qty,
      });
    }
  }

  const promotionInfo = await loadPromotions(cartId);
  // Re-validate attached promotions against the CURRENT cart (E2E-3):
  // min-spend/schedule/region conditions are checked at every read, so a code
  // applied above the threshold stops discounting once mutations drop below
  // it. The cart_promotion row stays — re-crossing re-applies the code.
  const subtotalMinor = priceLines.reduce((acc, l) => acc + l.unitPriceMinor * l.qty, 0);
  const eligiblePromotions = filterEligiblePromotions(promotionInfo.inputs, {
    subtotalMinor,
    region: cartRow.region,
    now: new Date(),
    productIds: lines.map((l) => l.variantId),
    categoryIds: [],
    isGuest: cartRow.userId === null,
  });
  const totals = computeCartTotals({
    lines: priceLines,
    promotions: eligiblePromotions.map((p) => ({ promotionId: p.id, kind: p.kind, value: p.value ?? 0 })),
    shippingMinor: 0,
    taxMinor: 0,
  });
  const eligibleIds = new Set(eligiblePromotions.map((p) => p.id));

  return {
    id: cartRow.id,
    currency: cartRow.currency,
    region: cartRow.region,
    lines,
    subtotalMinor: totals.subtotal,
    discountMinor: totals.discount,
    shippingMinor: null,
    taxMinor: totals.tax,
    totalMinor: totals.total,
    appliedPromotionCode:
      promotionInfo.rows.find((r) => eligibleIds.has(r.id))?.code ?? null,
  };
}
