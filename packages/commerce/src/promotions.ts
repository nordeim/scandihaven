/**
 * Promotion eligibility engine (PRD FR-810) — pure predicate evaluation;
 * persistence-side limits (usage counts) are enforced by the caller in the
 * order-placement transaction.
 */
import { z } from "zod";

export const promotionConditionsSchema = z.object({
  minSpendMinor: z.number().int().nonnegative().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  excludeProductIds: z.array(z.string().uuid()).optional(),
  regions: z.array(z.enum(["EU", "US", "UK"])).optional(),
});

export const promotionTierSchema = z.object({
  minSpendMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
});

export const promotionInputSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1).nullable(),
  kind: z.enum(["fixed", "percent", "free_shipping", "bogo", "tiered"]),
  /** Minor units (fixed) or basis points (percent). */
  value: z.number().int().nonnegative().nullable(),
  tiers: z.array(promotionTierSchema).nullable(),
  conditions: promotionConditionsSchema,
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  usageLimit: z.number().int().nonnegative().nullable(),
  perCustomerLimit: z.number().int().nonnegative().nullable(),
  usageCount: z.number().int().nonnegative(),
  perCustomerUsed: z.number().int().nonnegative(),
});

export type PromotionInput = z.infer<typeof promotionInputSchema>;

export type PromotionContext = {
  subtotalMinor: number;
  region: "EU" | "US" | "UK";
  now: Date;
  productIds: readonly string[];
  categoryIds: readonly string[];
  isGuest: boolean;
};

export type PromotionRejection =
  | "not_active"
  | "outside_schedule"
  | "min_spend"
  | "product_excluded"
  | "product_not_included"
  | "region_not_eligible"
  | "usage_limit"
  | "customer_limit";

export type PromotionEvaluation =
  | { eligible: true; promotion: PromotionInput }
  | { eligible: false; reason: PromotionRejection };

export function evaluatePromotion(
  promotion: PromotionInput,
  context: PromotionContext,
): PromotionEvaluation {
  if (!promotionConditionsSchema.safeParse(promotion.conditions).success) {
    return { eligible: false, reason: "not_active" };
  }
  if (promotion.startsAt && context.now < promotion.startsAt) {
    return { eligible: false, reason: "outside_schedule" };
  }
  if (promotion.endsAt && context.now > promotion.endsAt) {
    return { eligible: false, reason: "outside_schedule" };
  }
  const c = promotion.conditions;
  if (c.regions && !c.regions.includes(context.region)) {
    return { eligible: false, reason: "region_not_eligible" };
  }
  if (c.minSpendMinor !== undefined && context.subtotalMinor < c.minSpendMinor) {
    return { eligible: false, reason: "min_spend" };
  }
  if (c.excludeProductIds?.some((id) => context.productIds.includes(id))) {
    return { eligible: false, reason: "product_excluded" };
  }
  if (c.productIds && !c.productIds.some((id) => context.productIds.includes(id))) {
    return { eligible: false, reason: "product_not_included" };
  }
  if (c.categoryIds && !c.categoryIds.some((id) => context.categoryIds.includes(id))) {
    return { eligible: false, reason: "product_not_included" };
  }
  if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
    return { eligible: false, reason: "usage_limit" };
  }
  if (
    promotion.perCustomerLimit !== null &&
    promotion.perCustomerUsed >= promotion.perCustomerLimit
  ) {
    return { eligible: false, reason: "customer_limit" };
  }
  return { eligible: true, promotion };
}

/** Tiered promotions ("spend €500 get €50 off") resolve the best matching tier. */
export function resolveTier(
  promotion: PromotionInput,
  subtotalMinor: number,
): number | null {
  if (promotion.kind !== "tiered" || !promotion.tiers) return null;
  const qualifying = promotion.tiers
    .filter((tier) => subtotalMinor >= tier.minSpendMinor)
    .sort((a, b) => b.minSpendMinor - a.minSpendMinor);
  const tier = qualifying[0];
  return tier ? tier.discountMinor : null;
}
