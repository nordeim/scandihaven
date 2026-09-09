/** Catalog read services (PRD §8.1: RSC queries are the default read path). */
import { and, desc, eq, ilike, or, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@scandihaven/db/client";
import {
  category,
  collection,
  inventoryLevel,
  media,
  product,
  productImage,
  productVariant,
  review,
  variantPrice,
} from "@scandihaven/db/schema";
import type { ProductCardDto, VariantDto } from "./dto";

export const CURRENCY_BY_REGION = {
  EU: "EUR",
  US: "USD",
  UK: "GBP",
} as const;

export const productQuerySchema = z.object({
  categorySlug: z.string().optional(),
  material: z.array(z.string()).optional(),
  // Explicit product-ID filter (collection pages; audit 2026-09-09 M-COL).
  // Bounded so an unbounded IN list can't be coerced through the schema.
  ids: z.array(z.string().uuid()).max(500).optional(),
  availability: z.enum(["in_stock", "all"]).default("all"),
  sort: z
    .enum(["featured", "newest", "price_asc", "price_desc", "bestselling"])
    .default("featured"),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
  region: z.enum(["EU", "US", "UK"]).default("EU"),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;
export type ProductQueryInput = z.input<typeof productQuerySchema>;

export type ProductQueryResult = {
  items: ProductCardDto[];
  total: number;
  page: number;
  pageCount: number;
};

/** Category subtree ids (recursive CTE per PRD §8.8). */
async function categoryIdsInSubtree(rootSlug: string): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM category WHERE slug = ${rootSlug}
      UNION ALL
      SELECT c.id FROM category c JOIN tree t ON c.parent_id = t.id
    )
    SELECT id FROM tree
  `);
  return rows.rows.map((r) => r.id);
}

type CardRow = {
  id: string;
  slug: string;
  title: string;
  materials: string[];
  lead_time_days_min: number;
  lead_time_days_max: number;
  is_new: boolean;
  amount: number;
  compare_at: number | null;
  available: string | number | null;
  image_url: string | null;
  image_alt: string | null;
};

function toCard(row: CardRow): ProductCardDto {
  const available = Number(row.available ?? 0);
  const madeToOrder = available <= 0 && row.lead_time_days_max > 7;
  const outOfStock = available <= 0 && !madeToOrder;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    materialLine: row.materials.length > 0 ? row.materials.join(" · ") : null,
    imageUrl: row.image_url ?? "/products/placeholder.svg",
    imageAlt: row.image_alt ?? row.title,
    hoverImageUrl: null,
    priceMinor: Number(row.amount),
    compareAtMinor: row.compare_at ? Number(row.compare_at) : null,
    currency: "EUR",
    badge: row.is_new
      ? "new"
      : row.compare_at
        ? "sale"
        : available > 0 && available <= 5
          ? "low_stock"
          : null,
    availability: outOfStock ? "out_of_stock" : madeToOrder ? "made_to_order" : "in_stock",
    leadTimeDaysMin: row.lead_time_days_min,
    leadTimeDaysMax: row.lead_time_days_max,
  };
}

/**
 * One CTE round-trip: availability rollup (no join multiplication) + first image
 * via lateral sub-select + window COUNT for pagination (PRD §8.8).
 */
export async function listProducts(rawQuery: ProductQueryInput): Promise<ProductQueryResult> {
  const query = productQuerySchema.parse(rawQuery);
  const currency = CURRENCY_BY_REGION[query.region];
  const conditions = [sql`p.status = 'active'`];

  if (query.categorySlug) {
    const ids = await categoryIdsInSubtree(query.categorySlug);
    if (ids.length === 0) return { items: [], total: 0, page: query.page, pageCount: 0 };
    conditions.push(sql`p.category_id IN ${ids}`);
  }
  if (query.ids) {
    // Same binding idiom as the category subtree filter above (audit M-COL).
    // Empty list short-circuits so the SQL never sees an empty IN.
    if (query.ids.length === 0) return { items: [], total: 0, page: query.page, pageCount: 0 };
    conditions.push(sql`p.id IN ${query.ids}`);
  }
  if (query.material && query.material.length > 0) {
    conditions.push(sql`p.materials && ${query.material}::text[]`);
  }
  if (query.search) {
    conditions.push(
      or(
        sql`to_tsvector('english', p.title) @@ websearch_to_tsquery('english', ${query.search})`,
        sql`p.title ILIKE ${`%${query.search}%`}`,
      )!,
    );
  }
  if (query.availability === "in_stock") {
    conditions.push(sql`a.available > 0`);
  }

  const where = sql.join(conditions, sql` AND `);
  const orderBy =
    query.sort === "newest"
      ? sql`p.created_at DESC`
      : query.sort === "price_asc"
        ? sql`amount ASC`
        : query.sort === "price_desc"
          ? sql`amount DESC`
          : sql`p.sort_order ASC, p.title ASC`;

  // ID-filtered queries (collection grids) fetch the full member set — they
  // are not paginated, and the schema's 48 page-size cap must not re-introduce
  // the M-COL silent truncation. ids is bounded to 500 by the schema.
  const effectivePageSize = query.ids ? query.ids.length : query.pageSize;
  const effectivePage = query.ids ? 1 : query.page;
  const offset = (effectivePage - 1) * effectivePageSize;
  const result = await db.execute<CardRow & { total: string }>(sql`
    WITH avail AS (
      SELECT pv.product_id, SUM(il.qty_on_hand - il.qty_reserved - il.safety_stock) AS available
      FROM product_variant pv
      LEFT JOIN inventory_level il ON il.variant_id = pv.id
      WHERE pv.is_active
      GROUP BY pv.product_id
    ),
    cards AS (
      SELECT p.id, p.slug, p.title, p.materials,
             p.lead_time_days_min, p.lead_time_days_max, p.is_new,
             -- Card price = the DEFAULT variant's price so the card matches
             -- PDP, JSON-LD and quick-add (live E2E audit 2026-09-10, E2E-4:
             -- MIN advertised the cheapest variant while the customer is
             -- priced for the default). Products with no default variant
             -- (legacy data) keep the old MIN rollup, and compare_at follows
             -- the same variant so a sibling's sale can't fabricate a badge.
             COALESCE(MAX(vp.amount) FILTER (WHERE pv.is_default), MIN(vp.amount)) AS amount,
             CASE
               WHEN MAX(vp.amount) FILTER (WHERE pv.is_default) IS NOT NULL
                 THEN MAX(vp.compare_at) FILTER (WHERE pv.is_default)
               ELSE MAX(vp.compare_at)
             END AS compare_at,
             a.available,
             (SELECT m.url FROM product_image pi JOIN media m ON m.id = pi.media_id
              WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image_url,
             (SELECT m.alt FROM product_image pi JOIN media m ON m.id = pi.media_id
              WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image_alt
      FROM product p
      JOIN product_variant pv ON pv.product_id = p.id AND pv.is_active
      JOIN variant_price vp ON vp.variant_id = pv.id AND vp.currency = ${currency}
      JOIN avail a ON a.product_id = p.id
      WHERE ${where}
      GROUP BY p.id, a.available
      ORDER BY ${orderBy}
    )
    SELECT *, COUNT(*) OVER () AS total
    FROM cards
    LIMIT ${effectivePageSize} OFFSET ${offset}
  `);

  const rows = result.rows;
  const total = rows[0] ? Number(rows[0].total) : 0;
  return {
    items: rows.map(toCard),
    total,
    page: effectivePage,
    pageCount: Math.max(1, Math.ceil(total / effectivePageSize)),
  };
}

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  descriptionHtml: string | null;
  materials: string[];
  careHtml: string | null;
  sustainabilityHtml: string | null;
  dimensionsJson: unknown;
  categoryId: string | null;
  categoryName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  currency: string;
  /** Product-level lead-time window (variants may override; FR-304). */
  leadTimeDaysMin: number;
  leadTimeDaysMax: number;
  variants: VariantDto[];
  images: Array<{ url: string; alt: string }>;
  reviews: Array<{
    id: string;
    authorName: string;
    rating: number;
    title: string | null;
    body: string;
    createdAt: Date;
  }>;
  ratingAverage: number | null;
  ratingCount: number;
};

export async function getProduct(
  slug: string,
  region: keyof typeof CURRENCY_BY_REGION = "EU",
): Promise<ProductDetail | null> {
  const currency = CURRENCY_BY_REGION[region];
  const rows = await db
    .select({ product, categoryName: category.name })
    .from(product)
    .leftJoin(category, eq(category.id, product.categoryId))
    .where(and(eq(product.slug, slug), eq(product.status, "active")))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const variantRows = await db
    .select({
      variant: productVariant,
      amount: variantPrice.amount,
      compareAt: variantPrice.compareAt,
      available: sql<number>`COALESCE(SUM(${inventoryLevel.qtyOnHand} - ${inventoryLevel.qtyReserved} - ${inventoryLevel.safetyStock}), 0)`,
    })
    .from(productVariant)
    .innerJoin(
      variantPrice,
      and(eq(variantPrice.variantId, productVariant.id), eq(variantPrice.currency, currency)),
    )
    .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, productVariant.id))
    .where(and(eq(productVariant.productId, row.product.id), eq(productVariant.isActive, true)))
    .groupBy(productVariant.id, variantPrice.amount, variantPrice.compareAt)
    .orderBy(desc(productVariant.isDefault), asc(productVariant.sku));

  const imageRows = await db
    .select({ url: media.url, alt: media.alt })
    .from(productImage)
    .innerJoin(media, eq(media.id, productImage.mediaId))
    .where(eq(productImage.productId, row.product.id))
    .orderBy(asc(productImage.sortOrder));

  const reviewRows = await db
    .select({
      id: review.id,
      authorName: review.authorName,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt,
    })
    .from(review)
    .where(and(eq(review.productId, row.product.id), eq(review.status, "approved")))
    .orderBy(desc(review.createdAt))
    .limit(50);

  const variants: VariantDto[] = variantRows.map((v) => {
    const available = Number(v.available ?? 0);
    const madeToOrder = available <= 0 && row.product.leadTimeDaysMax > 7;
    return {
      id: v.variant.id,
      sku: v.variant.sku,
      material: v.variant.material,
      color: v.variant.color,
      colorHex: v.variant.colorHex,
      size: v.variant.size,
      priceMinor: v.amount,
      compareAtMinor: v.compareAt,
      availability: available > 0 ? "in_stock" : madeToOrder ? "made_to_order" : "out_of_stock",
      isDefault: v.variant.isDefault,
    };
  });

  const ratingCount = reviewRows.length;
  const ratingAverage =
    ratingCount > 0 ? reviewRows.reduce((acc, r) => acc + r.rating, 0) / ratingCount : null;

  return {
    id: row.product.id,
    slug: row.product.slug,
    title: row.product.title,
    descriptionHtml: row.product.descriptionHtml,
    materials: row.product.materials,
    careHtml: row.product.careHtml,
    sustainabilityHtml: row.product.sustainabilityHtml,
    dimensionsJson: row.product.dimensionsJson,
    categoryId: row.product.categoryId,
    categoryName: row.categoryName,
    seoTitle: row.product.seoTitle,
    seoDescription: row.product.seoDescription,
    currency,
    leadTimeDaysMin: row.product.leadTimeDaysMin,
    leadTimeDaysMax: row.product.leadTimeDaysMax,
    variants,
    images: imageRows,
    reviews: reviewRows,
    ratingAverage,
    ratingCount,
  };
}

export async function listCollections() {
  return db
    .select({
      slug: collection.slug,
      title: collection.title,
      subtitle: collection.subtitle,
    })
    .from(collection)
    .where(eq(collection.isActive, true))
    .orderBy(asc(collection.title));
}

export async function listFeaturedCategories() {
  return db
    .select({ slug: category.slug, name: category.name })
    .from(category)
    .where(and(eq(category.isActive, true), sql`${category.parentId} IS NULL`))
    .orderBy(asc(category.sortOrder))
    .limit(4);
}

export async function listLatestJournal(limit = 3) {
  const { journalPost } = await import("@scandihaven/db/schema");
  return db
    .select({
      slug: journalPost.slug,
      title: journalPost.title,
      excerpt: journalPost.excerpt,
      category: journalPost.category,
    })
    .from(journalPost)
    .where(eq(journalPost.isPublished, true))
    .orderBy(desc(journalPost.publishedAt))
    .limit(limit);
}

export async function searchTypeahead(q: string, limit = 8) {
  const rows = await db
    .select({ slug: product.slug, title: product.title })
    .from(product)
    .where(
      and(
        eq(product.status, "active"),
        or(
          sql`to_tsvector('english', ${product.title}) @@ websearch_to_tsquery('english', ${q})`,
          ilike(product.title, `%${q}%`),
        )!,
      ),
    )
    .limit(limit);
  return rows;
}
