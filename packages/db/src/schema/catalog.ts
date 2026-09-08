/** Catalog domain — PRD §7.3. */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { citext } from "./custom";
import { user } from "./auth";
import {
  mediaKindEnum,
  movementReasonEnum,
  productStatusEnum,
  reviewStatusEnum,
} from "./enums";

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    slug: citext("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("category_slug_idx").on(table.slug),
    index("category_parent_sort_idx").on(table.parentId, table.sortOrder),
  ],
);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: mediaKindEnum("kind").notNull().default("image"),
  url: text("url").notNull(),
  // Alt text is mandatory (PRD FR-301, §12.2) — empty strings are rejected at the app boundary.
  alt: text("alt").notNull(),
  width: integer("width"),
  height: integer("height"),
  blurDataUrl: text("blur_data_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: citext("slug").notNull(),
    title: text("title").notNull(),
    descriptionHtml: text("description_html"),
    status: productStatusEnum("status").notNull().default("draft"),
    categoryId: uuid("category_id").references(() => category.id),
    brand: text("brand").default("Scandi Haven"),
    countryOfOrigin: char("country_of_origin", { length: 2 }),
    hsCode: text("hs_code"),
    leadTimeDaysMin: integer("lead_time_days_min").notNull().default(2),
    leadTimeDaysMax: integer("lead_time_days_max").notNull().default(4),
    isNew: boolean("is_new").notNull().default(false),
    isPreorder: boolean("is_preorder").notNull().default(false),
    preorderShipsOn: date("preorder_ships_on"),
    materials: text("materials").array().notNull().default(sql`ARRAY[]::text[]`),
    careHtml: text("care_html"),
    sustainabilityHtml: text("sustainability_html"),
    dimensionsJson: jsonb("dimensions_json"),
    weightG: integer("weight_g"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_slug_idx").on(table.slug),
    index("product_status_sort_idx").on(table.status, table.sortOrder),
    index("product_category_idx").on(table.categoryId),
  ],
);

export const productVariant = pgTable(
  "product_variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    material: text("material"),
    color: text("color"),
    colorHex: char("color_hex", { length: 7 }),
    size: text("size"),
    dimensionsJson: jsonb("dimensions_json"),
    weightG: integer("weight_g"),
    leadTimeDaysMinOverride: integer("lead_time_days_min_override"),
    leadTimeDaysMaxOverride: integer("lead_time_days_max_override"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_variant_sku_idx").on(table.sku),
    index("product_variant_product_idx").on(table.productId),
  ],
);

export const productImage = pgTable(
  "product_image",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.productId, table.mediaId] })],
);

export const variantImage = pgTable(
  "variant_image",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.variantId, table.mediaId] })],
);

export const variantPrice = pgTable(
  "variant_price",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    currency: char("currency", { length: 3 }).notNull(),
    amount: integer("amount").notNull(),
    compareAt: integer("compare_at"),
    tradeAmount: integer("trade_amount"),
    saleAmount: integer("sale_amount"),
    saleStartsAt: timestamp("sale_starts_at", { withTimezone: true }),
    saleEndsAt: timestamp("sale_ends_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("variant_price_variant_currency_idx").on(table.variantId, table.currency),
  ],
);

export const warehouse = pgTable("warehouse", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: jsonb("address"),
  isShowroom: boolean("is_showroom").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryLevel = pgTable(
  "inventory_level",
  {
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "restrict" }),
    qtyOnHand: integer("qty_on_hand").notNull().default(0),
    qtyReserved: integer("qty_reserved").notNull().default(0),
    safetyStock: integer("safety_stock").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.variantId, table.warehouseId] })],
);

export const inventoryMovement = pgTable(
  "inventory_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "restrict" }),
    delta: integer("delta").notNull(),
    reason: movementReasonEnum("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("inventory_movement_variant_created_idx").on(table.variantId, table.createdAt),
  ],
);

export const collection = pgTable(
  "collection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: citext("slug").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    heroMediaId: uuid("hero_media_id").references(() => media.id),
    storyHtml: text("story_html"),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("collection_slug_idx").on(table.slug)],
);

export const collectionProduct = pgTable(
  "collection_product",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.productId] })],
);

export const searchSynonym = pgTable(
  "search_synonym",
  {
    term: text("term").notNull(),
    synonym: text("synonym").notNull(),
  },
  (table) => [primaryKey({ columns: [table.term, table.synonym] })],
);

export const review = pgTable(
  "review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => user.id),
    // No FK: orders live in orders.ts; enforced at application level to avoid a circular schema import.
    orderId: uuid("order_id"),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    photos: jsonb("photos").notNull().default(sql`'[]'::jsonb`),
    status: reviewStatusEnum("status").notNull().default("pending"),
    isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("review_product_status_created_idx").on(table.productId, table.status, table.createdAt),
  ],
);

export const backInStockRequest = pgTable(
  "back_in_stock_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("back_in_stock_variant_email_idx").on(table.variantId, table.email)],
);

// ---- Relations ----
export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "categoryTree",
  }),
  children: many(category, { relationName: "categoryTree" }),
  products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category, { fields: [product.categoryId], references: [category.id] }),
  variants: many(productVariant),
  images: many(productImage),
  reviews: many(review),
}));

export const productVariantRelations = relations(productVariant, ({ one, many }) => ({
  product: one(product, { fields: [productVariant.productId], references: [product.id] }),
  prices: many(variantPrice),
  images: many(variantImage),
  inventory: many(inventoryLevel),
}));

export const variantPriceRelations = relations(variantPrice, ({ one }) => ({
  variant: one(productVariant, {
    fields: [variantPrice.variantId],
    references: [productVariant.id],
  }),
}));

export const inventoryLevelRelations = relations(inventoryLevel, ({ one }) => ({
  variant: one(productVariant, {
    fields: [inventoryLevel.variantId],
    references: [productVariant.id],
  }),
  warehouse: one(warehouse, {
    fields: [inventoryLevel.warehouseId],
    references: [warehouse.id],
  }),
}));

export const collectionRelations = relations(collection, ({ many }) => ({
  products: many(collectionProduct),
}));

export const collectionProductRelations = relations(collectionProduct, ({ one }) => ({
  collection: one(collection, {
    fields: [collectionProduct.collectionId],
    references: [collection.id],
  }),
  product: one(product, { fields: [collectionProduct.productId], references: [product.id] }),
}));

export const reviewRelations = relations(review, ({ one }) => ({
  product: one(product, { fields: [review.productId], references: [product.id] }),
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, { fields: [productImage.productId], references: [product.id] }),
  media: one(media, { fields: [productImage.mediaId], references: [media.id] }),
}));

export const variantImageRelations = relations(variantImage, ({ one }) => ({
  variant: one(productVariant, {
    fields: [variantImage.variantId],
    references: [productVariant.id],
  }),
  media: one(media, { fields: [variantImage.mediaId], references: [media.id] }),
}));
