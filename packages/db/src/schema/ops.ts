/** Ops: audit, webhooks, outbox jobs, rate limiting, redirects, FX, shipping — PRD §7.8. */
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
import { citext } from "./custom";
import { jobStatusEnum, shippingMethodEnum, subscriberStatusEnum } from "./enums";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_log_entity_idx").on(table.entityType, table.entityId, table.createdAt)],
);

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripeEventId: text("stripe_event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("webhook_event_stripe_id_idx").on(table.stripeEventId)],
);

export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_idempotency_idx").on(table.idempotencyKey),
    index("job_status_run_after_idx").on(table.status, table.runAfter),
  ],
);

export const rateLimitHit = pgTable(
  "rate_limit_hit",
  {
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.bucket, table.windowStart] })],
);

export const newsletterSubscriber = pgTable(
  "newsletter_subscriber",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").notNull(),
    status: subscriberStatusEnum("status").notNull().default("pending"),
    tokenHash: text("token_hash"),
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("newsletter_email_idx").on(table.email)],
);

export const fxRate = pgTable("fx_rate", {
  currency: char("currency", { length: 3 }).primaryKey(),
  rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shippingZone = pgTable(
  "shipping_zone",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    region: text("region").notNull(),
    countries: text("countries").array().notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("shipping_zone_region_idx").on(table.region)],
);

export const shippingRate = pgTable(
  "shipping_rate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => shippingZone.id, { onDelete: "cascade" }),
    method: shippingMethodEnum("method").notNull(),
    minWeightG: integer("min_weight_g").notNull().default(0),
    maxWeightG: integer("max_weight_g"),
    amount: integer("amount").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    etaDaysMin: integer("eta_days_min").notNull().default(2),
    etaDaysMax: integer("eta_days_max").notNull().default(5),
  },
  (table) => [index("shipping_rate_zone_method_idx").on(table.zoneId, table.method)],
);

export const analyticsEvent = pgTable(
  "analytics_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    payload: jsonb("payload").notNull(),
    // Server-authoritative events (e.g. order_completed, PRD §11.2) land here
    // inside the same transaction as the state change they describe.
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("analytics_event_name_time_idx").on(table.name, table.occurredAt)],
);

// ---- Relations ----
export const shippingRateRelations = relations(shippingRate, ({ one }) => ({
  zone: one(shippingZone, { fields: [shippingRate.zoneId], references: [shippingZone.id] }),
}));
