/** Content & editorial — PRD §7.8 (static pages, journal, lookbooks, nav, announcements). */
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
import { media, product } from "./catalog";
import { journalCategoryEnum, navMenuEnum, redirectKindEnum } from "./enums";

export const staticPage = pgTable(
  "static_page",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: citext("slug").notNull(),
    title: text("title").notNull(),
    bodyHtml: text("body_html").notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("static_page_slug_idx").on(table.slug)],
);

export const journalPost = pgTable(
  "journal_post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: citext("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    heroMediaId: uuid("hero_media_id").references(() => media.id),
    bodyHtml: text("body_html").notNull(),
    category: journalCategoryEnum("category").notNull(),
    author: text("author").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    relatedProductIds: jsonb("related_product_ids").notNull().default("[]"),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("journal_post_slug_idx").on(table.slug),
    index("journal_post_category_published_idx").on(table.category, table.publishedAt),
  ],
);

export const lookbook = pgTable(
  "lookbook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: citext("slug").notNull(),
    title: text("title").notNull(),
    season: text("season").notNull(),
    heroMediaId: uuid("hero_media_id").references(() => media.id),
    // [{ mediaId, xPercent, yPercent, productSlug }]
    hotspots: jsonb("hotspots").notNull().default("[]"),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("lookbook_slug_idx").on(table.slug)],
);

export const announcement = pgTable("announcement", {
  id: uuid("id").primaryKey().defaultRandom(),
  message: text("message").notNull(),
  href: text("href"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const navEntry = pgTable(
  "nav_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    menu: navMenuEnum("menu").notNull(),
    label: text("label").notNull(),
    href: text("href").notNull(),
    parentId: uuid("parent_id"),
    // Optional featured collection thumbnail for mega-menu columns (PRD FR-103)
    featuredMediaId: uuid("featured_media_id").references(() => media.id),
    featuredCollectionSlug: citext("featured_collection_slug"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("nav_entry_menu_sort_idx").on(table.menu, table.sortOrder)],
);

export const redirect = pgTable(
  "redirect",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourcePath: text("source_path").notNull(),
    targetPath: text("target_path").notNull(),
    kind: redirectKindEnum("kind").notNull().default("301"),
    hits: integer("hits").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("redirect_source_idx").on(table.sourcePath)],
);

export const productLocale = pgTable(
  "product_locale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    locale: char("locale", { length: 5 }).notNull(),
    title: text("title"),
    descriptionHtml: text("description_html"),
    careHtml: text("care_html"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
  },
  (table) => [uniqueIndex("product_locale_idx").on(table.productId, table.locale)],
);

// ---- Relations ----
export const journalPostRelations = relations(journalPost, ({ one }) => ({
  hero: one(media, { fields: [journalPost.heroMediaId], references: [media.id] }),
}));

export const lookbookRelations = relations(lookbook, ({ one }) => ({
  hero: one(media, { fields: [lookbook.heroMediaId], references: [media.id] }),
}));

export const productLocaleRelations = relations(productLocale, ({ one }) => ({
  product: one(product, { fields: [productLocale.productId], references: [product.id] }),
}));
