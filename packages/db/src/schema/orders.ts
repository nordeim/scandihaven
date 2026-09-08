/** Carts, orders, payments, shipments, returns — PRD §7.4. */
import { relations } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { productVariant, warehouse } from "./catalog";
import { promotion } from "./customers";
import {
  addressKindEnum,
  cartStatusEnum,
  lineConditionEnum,
  orderSourceEnum,
  orderStatusEnum,
  paymentStatusEnum,
  paymentTermsEnum,
  regionEnum,
  returnStatusEnum,
  shipmentStatusEnum,
} from "./enums";

export const cart = pgTable(
  "cart",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email"),
    region: regionEnum("region").notNull().default("EU"),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    status: cartStatusEnum("status").notNull().default("active"),
    giftMessage: text("gift_message"),
    giftWrap: boolean("gift_wrap").notNull().default(false),
    giftReceipt: boolean("gift_receipt").notNull().default(false),
    shippingMethod: text("shipping_method"),
    totalsJson: jsonb("totals_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_token_idx").on(table.token),
    index("cart_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

export const cartLine = pgTable(
  "cart_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull(),
    unitPriceSnapshot: integer("unit_price_snapshot").notNull(),
    isGiftWrap: boolean("is_gift_wrap").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_line_unique_idx").on(table.cartId, table.variantId, table.isGiftWrap),
  ],
);

export const cartPromotion = pgTable(
  "cart_promotion",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotion.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cartId, table.promotionId] })],
);

export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    cartId: uuid("cart_id").references(() => cart.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    region: regionEnum("region").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    fxRate: numeric("fx_rate", { precision: 18, scale: 8 }).notNull().default("1"),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    shipping: integer("shipping").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull(),
    totalEur: integer("total_eur").notNull(),
    paymentTerms: paymentTermsEnum("payment_terms").notNull().default("card"),
    giftMessage: text("gift_message"),
    giftWrap: boolean("gift_wrap").notNull().default(false),
    giftReceipt: boolean("gift_receipt").notNull().default(false),
    source: orderSourceEnum("source").notNull().default("web"),
    placedAt: timestamp("placed_at", { withTimezone: true }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("order_number_idx").on(table.number),
    index("order_status_placed_idx").on(table.status, table.placedAt),
    index("order_user_idx").on(table.userId),
  ],
);

export const orderLine = pgTable(
  "order_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "restrict" }),
    titleSnapshot: text("title_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot").notNull(),
    qty: integer("qty").notNull(),
    unitPrice: integer("unit_price").notNull(),
    taxRate: numeric("tax_rate", { precision: 6, scale: 4 }),
    taxAmount: integer("tax_amount").notNull().default(0),
    total: integer("total").notNull(),
    fulfillableFrom: text("fulfillable_from"),
  },
  (table) => [index("order_line_order_idx").on(table.orderId)],
);

export const orderAddress = pgTable(
  "order_address",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    kind: addressKindEnum("kind").notNull(),
    fields: jsonb("fields").notNull(),
  },
  (table) => [index("order_address_order_idx").on(table.orderId)],
);

export const orderEvent = pgTable(
  "order_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actor: text("actor").notNull().default("system"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_event_order_created_idx").on(table.orderId, table.createdAt)],
);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
    amount: integer("amount").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    status: paymentStatusEnum("status").notNull().default("requires_action"),
    amountRefunded: integer("amount_refunded").notNull().default(0),
    methodDetails: jsonb("method_details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_intent_idx").on(table.stripePaymentIntentId),
    index("payment_order_status_idx").on(table.orderId, table.status),
  ],
);

export const shipment = pgTable(
  "shipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "restrict" }),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    status: shipmentStatusEnum("status").notNull().default("pending"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("shipment_order_status_idx").on(table.orderId, table.status)],
);

export const shipmentLine = pgTable(
  "shipment_line",
  {
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipment.id, { onDelete: "cascade" }),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLine.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull(),
  },
  (table) => [primaryKey({ columns: [table.shipmentId, table.orderLineId] })],
);

export const returnRequest = pgTable(
  "return_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    rmaNumber: text("rma_number").notNull(),
    status: returnStatusEnum("status").notNull().default("requested"),
    reasonCode: text("reason_code").notNull(),
    customerNote: text("customer_note"),
    photoMediaIds: jsonb("photo_media_ids"),
    refundAmount: integer("refund_amount"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("return_rma_idx").on(table.rmaNumber),
    index("return_order_status_idx").on(table.orderId, table.status),
  ],
);

export const returnLine = pgTable(
  "return_line",
  {
    returnRequestId: uuid("return_request_id")
      .notNull()
      .references(() => returnRequest.id, { onDelete: "cascade" }),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLine.id, { onDelete: "restrict" }),
    qty: integer("qty").notNull(),
    condition: lineConditionEnum("condition").notNull().default("unopened"),
  },
  (table) => [primaryKey({ columns: [table.returnRequestId, table.orderLineId] })],
);

// ---- Relations ----
export const cartRelations = relations(cart, ({ many, one }) => ({
  lines: many(cartLine),
  promotions: many(cartPromotion),
  user: one(user, { fields: [cart.userId], references: [user.id] }),
}));

export const cartLineRelations = relations(cartLine, ({ one }) => ({
  cart: one(cart, { fields: [cartLine.cartId], references: [cart.id] }),
  variant: one(productVariant, { fields: [cartLine.variantId], references: [productVariant.id] }),
}));

export const cartPromotionRelations = relations(cartPromotion, ({ one }) => ({
  cart: one(cart, { fields: [cartPromotion.cartId], references: [cart.id] }),
  promotion: one(promotion, { fields: [cartPromotion.promotionId], references: [promotion.id] }),
}));

export const orderRelations = relations(order, ({ many, one }) => ({
  lines: many(orderLine),
  addresses: many(orderAddress),
  events: many(orderEvent),
  payments: many(payment),
  shipments: many(shipment),
  user: one(user, { fields: [order.userId], references: [user.id] }),
}));

export const orderLineRelations = relations(orderLine, ({ one }) => ({
  order: one(order, { fields: [orderLine.orderId], references: [order.id] }),
  variant: one(productVariant, {
    fields: [orderLine.variantId],
    references: [productVariant.id],
  }),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
  order: one(order, { fields: [payment.orderId], references: [order.id] }),
}));

export const shipmentRelations = relations(shipment, ({ one, many }) => ({
  order: one(order, { fields: [shipment.orderId], references: [order.id] }),
  warehouse: one(warehouse, { fields: [shipment.warehouseId], references: [warehouse.id] }),
  lines: many(shipmentLine),
}));

export const returnRequestRelations = relations(returnRequest, ({ one, many }) => ({
  order: one(order, { fields: [returnRequest.orderId], references: [order.id] }),
  lines: many(returnLine),
}));
