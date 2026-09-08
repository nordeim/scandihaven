/** Customers, addresses, trade, promotions, gift cards — PRD §7.5. */
import { relations } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { citext } from "./custom";
import { user } from "./auth";
import { media } from "./catalog";
import {
  giftCardStatusEnum,
  giftCardTxKindEnum,
  promotionKindEnum,
  tradeStatusEnum,
} from "./enums";

export const address = pgTable(
  "address",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label"),
    fields: jsonb("fields").notNull(),
    isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
    isDefaultBilling: boolean("is_default_billing").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("address_user_idx").on(table.userId)],
);

export const tradeApplication = pgTable(
  "trade_application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    companyName: text("company_name").notNull(),
    cvr: text("cvr").notNull(),
    contactEmail: citext("contact_email").notNull(),
    website: text("website"),
    certificateMediaId: uuid("certificate_media_id").references(() => media.id),
    status: tradeStatusEnum("status").notNull().default("pending"),
    reviewerId: text("reviewer_id"),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trade_application_status_idx").on(table.status)],
);

export const promotion = pgTable(
  "promotion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null code ⇒ automatic promotion (no code entry needed)
    code: citext("code"),
    kind: promotionKindEnum("kind").notNull(),
    value: integer("value"),
    tiersJson: jsonb("tiers_json"),
    conditionsJson: jsonb("conditions_json").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("promotion_code_idx").on(table.code)],
);

export const promotionRedemption = pgTable(
  "promotion_redemption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotion.id, { onDelete: "restrict" }),
    orderId: uuid("order_id"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    emailHash: text("email_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("promotion_redemption_scope_idx").on(table.promotionId, table.userId)],
);

export const giftCard = pgTable(
  "gift_card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeHash: text("code_hash").notNull(),
    codeLast4: char("code_last4", { length: 4 }).notNull(),
    initialAmount: integer("initial_amount").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    balance: integer("balance").notNull(),
    // App-level reference (kept FK-free to avoid orders.ts circular import).
    purchaserOrderId: uuid("purchaser_order_id"),
    recipientEmail: citext("recipient_email"),
    deliverAt: timestamp("deliver_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: giftCardStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("gift_card_code_hash_idx").on(table.codeHash),
    index("gift_card_status_idx").on(table.status),
  ],
);

export const giftCardTransaction = pgTable(
  "gift_card_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    giftCardId: uuid("gift_card_id")
      .notNull()
      .references(() => giftCard.id, { onDelete: "restrict" }),
    orderId: uuid("order_id"),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    kind: giftCardTxKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("gift_card_tx_card_idx").on(table.giftCardId, table.createdAt)],
);

// ---- Relations ----
export const addressRelations = relations(address, ({ one }) => ({
  user: one(user, { fields: [address.userId], references: [user.id] }),
}));

export const tradeApplicationRelations = relations(tradeApplication, ({ one }) => ({
  user: one(user, { fields: [tradeApplication.userId], references: [user.id] }),
  certificate: one(media, {
    fields: [tradeApplication.certificateMediaId],
    references: [media.id],
  }),
}));

export const promotionRelations = relations(promotion, ({ many }) => ({
  redemptions: many(promotionRedemption),
}));

export const giftCardRelations = relations(giftCard, ({ many }) => ({
  transactions: many(giftCardTransaction),
}));

export const giftCardTransactionRelations = relations(giftCardTransaction, ({ one }) => ({
  giftCard: one(giftCard, {
    fields: [giftCardTransaction.giftCardId],
    references: [giftCard.id],
  }),
}));
