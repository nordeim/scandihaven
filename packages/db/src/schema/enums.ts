/**
 * Shared enum + column helpers (PRD §7.1 conventions).
 * Money is ALWAYS integer minor units. Timestamps are timestamptz (UTC).
 */
import { pgEnum } from "drizzle-orm/pg-core";

// ---- Catalog ----
export const productStatusEnum = pgEnum("product_status", ["draft", "active", "archived"]);
export const mediaKindEnum = pgEnum("media_kind", ["image", "video"]);

// ---- Carts & orders ----
export const regionEnum = pgEnum("region", ["EU", "US", "UK"]);
export const cartStatusEnum = pgEnum("cart_status", ["active", "converted", "abandoned", "merged"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "review",
  "confirmed",
  "in_production",
  "partially_shipped",
  "shipped",
  "delivered",
  "closed",
  "cancelled",
  "refunded",
  "partially_refunded",
]);
export const orderSourceEnum = pgEnum("order_source", ["web", "trade", "admin"]);
export const paymentTermsEnum = pgEnum("payment_terms", ["card", "net30"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "requires_action",
  "processing",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);
export const addressKindEnum = pgEnum("address_kind", ["billing", "shipping"]);
export const shipmentStatusEnum = pgEnum("shipment_status", [
  "pending",
  "packed",
  "shipped",
  "delivered",
  "returned",
]);
export const returnStatusEnum = pgEnum("return_status", [
  "requested",
  "approved",
  "awaiting_shipment",
  "in_transit",
  "inspecting",
  "refunded",
  "exchanged",
  "rejected",
  "closed",
]);
export const lineConditionEnum = pgEnum("line_condition", ["unopened", "opened", "damaged"]);

// ---- Customers & promotions ----
export const tradeStatusEnum = pgEnum("trade_status", ["none", "pending", "approved", "rejected"]);
export const promotionKindEnum = pgEnum("promotion_kind", [
  "fixed",
  "percent",
  "free_shipping",
  "bogo",
  "tiered",
]);
export const giftCardStatusEnum = pgEnum("gift_card_status", [
  "active",
  "depleted",
  "expired",
  "disabled",
]);
export const giftCardTxKindEnum = pgEnum("gift_card_tx_kind", ["issue", "redeem", "refund", "expire"]);

// ---- Ops ----
export const movementReasonEnum = pgEnum("movement_reason", [
  "purchase",
  "sale",
  "return",
  "adjustment",
  "transfer",
  "reservation",
  "release",
]);
export const shippingMethodEnum = pgEnum("shipping_method", [
  "standard",
  "express",
  "white_glove",
  "pickup",
]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "done", "failed", "dead"]);
export const redirectKindEnum = pgEnum("redirect_kind", ["301", "302"]);
export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "pending",
  "confirmed",
  "unsubscribed",
]);
export const journalCategoryEnum = pgEnum("journal_category", [
  "craft",
  "home",
  "people",
  "sustainability",
]);
export const navMenuEnum = pgEnum("nav_menu", [
  "header",
  "footer_shop",
  "footer_about",
  "footer_help",
]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);
