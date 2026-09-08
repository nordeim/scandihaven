/** Serializable DTOs crossing the RSC → client boundary (PRD §8.1). */
import { z } from "zod";

export const productCardDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  materialLine: z.string().nullable(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  hoverImageUrl: z.string().nullable(),
  priceMinor: z.number().int(),
  compareAtMinor: z.number().int().nullable(),
  currency: z.string().length(3),
  badge: z.enum(["new", "sale", "low_stock"]).nullable(),
  availability: z.enum(["in_stock", "made_to_order", "out_of_stock"]),
  leadTimeDaysMin: z.number().int(),
  leadTimeDaysMax: z.number().int(),
});

export type ProductCardDto = z.infer<typeof productCardDtoSchema>;

export const variantDtoSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  material: z.string().nullable(),
  color: z.string().nullable(),
  colorHex: z.string().nullable(),
  size: z.string().nullable(),
  priceMinor: z.number().int(),
  compareAtMinor: z.number().int().nullable(),
  availability: z.enum(["in_stock", "made_to_order", "out_of_stock"]),
  isDefault: z.boolean(),
});

export type VariantDto = z.infer<typeof variantDtoSchema>;

export const cartLineDtoSchema = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  productSlug: z.string(),
  productTitle: z.string(),
  variantLabel: z.string(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  qty: z.number().int().min(1).max(99),
  unitPriceMinor: z.number().int(),
  totalMinor: z.number().int(),
});

export type CartLineDto = z.infer<typeof cartLineDtoSchema>;

export const cartDtoSchema = z.object({
  id: z.string().uuid(),
  currency: z.string().length(3),
  region: z.enum(["EU", "US", "UK"]),
  lines: z.array(cartLineDtoSchema),
  subtotalMinor: z.number().int(),
  discountMinor: z.number().int(),
  shippingMinor: z.number().int().nullable(),
  taxMinor: z.number().int(),
  totalMinor: z.number().int(),
  appliedPromotionCode: z.string().nullable(),
});

export type CartDto = z.infer<typeof cartDtoSchema>;

export type Region = "EU" | "US" | "UK";
