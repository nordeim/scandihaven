/**
 * Idempotent seed (PRD §7.9): every insert keys on a natural unique key with
 * ON CONFLICT DO NOTHING, guarded by a Postgres advisory lock so concurrent
 * seeders serialize. Re-running is always safe; nothing is ever overwritten.
 *
 * Seeded credentials: none. Admin/customer users are created through Better-Auth
 * (`pnpm seed:admin` / the sign-up flow), never by direct row inserts here.
 */
import { sql } from "drizzle-orm";
import { db } from "../client";
import {
  announcement,
  category,
  collection,
  collectionProduct,
  fxRate,
  inventoryLevel,
  journalPost,
  media,
  navEntry,
  product,
  productImage,
  productVariant,
  searchSynonym,
  shippingRate,
  shippingZone,
  staticPage,
  variantImage,
  variantPrice,
  warehouse,
} from "../schema";

const SEED_LOCK_KEY = 742_193_001;

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`DATABASE_URL is not a valid connection string (got: "${url.replace(/:[^:@]*@/, ":***@")}").`);
  }
  const allowed = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!allowed.has(host)) {
    throw new Error(
      `Refusing to seed non-local database host "${host}". Seed data is for development only (PRD §13.7).`,
    );
  }
}

const DEMO_MEDIA: Array<{ id: string; url: string; alt: string }> = [
  { id: "10000000-0000-4000-8000-000000000001", url: "/products/halden-armchair.svg", alt: "Halden linen armchair in oak with sand upholstery, three-quarter view" },
  { id: "10000000-0000-4000-8000-000000000002", url: "/products/halden-armchair-2.svg", alt: "Halden linen armchair detail of oak frame joinery" },
  { id: "10000000-0000-4000-8000-000000000003", url: "/products/oresund-lamp.svg", alt: "Oresund table lamp with brushed brass stem and linen shade" },
  { id: "10000000-0000-4000-8000-000000000004", url: "/products/hygge-throw.svg", alt: "Hygge wool throw folded in sand colour" },
  { id: "10000000-0000-4000-8000-000000000005", url: "/products/woo-runner.svg", alt: "Woo table runner in undyed linen on a set table" },
  { id: "10000000-0000-4000-8000-000000000006", url: "/products/birch-side-table.svg", alt: "Birch side table in natural oak with round top" },
  { id: "10000000-0000-4000-8000-000000000007", url: "/products/kyst-vase.svg", alt: "Kyst stoneware vase in matte white glaze" },
  { id: "10000000-0000-4000-8000-000000000008", url: "/products/hygge-edit.svg", alt: "The Hygge Edit — warm living room scene in evening light" },
];

type VariantSeed = {
  sku: string;
  material?: string;
  color?: string;
  colorHex?: string;
  size?: string;
  isDefault?: boolean;
  priceMinor: number;
  compareAtMinor?: number;
  stockByWarehouse: Record<string, number>;
  imageUrls: string[];
};

type ProductSeed = {
  slug: string;
  title: string;
  categorySlug: string;
  descriptionHtml: string;
  status: "draft" | "active" | "archived";
  isNew?: boolean;
  isMadeToOrder?: boolean;
  leadTimeDays: [number, number];
  weightG: number;
  countryOfOrigin: string;
  hsCode: string;
  materials: string[];
  careHtml: string;
  sustainabilityHtml: string;
  seoTitle: string;
  seoDescription: string;
  variants: VariantSeed[];
  collections: string[];
};

const DEMO_PRODUCTS: ProductSeed[] = [
  {
    slug: "halden-linen-armchair",
    title: "Halden Linen Armchair",
    categorySlug: "seating",
    status: "active",
    isNew: true,
    isMadeToOrder: true,
    leadTimeDays: [42, 56],
    weightG: 18_000,
    countryOfOrigin: "DK",
    hsCode: "9401.61",
    materials: ["FSC oak", "Belgian linen"],
    descriptionHtml:
      "<p>The Halden armchair is built the slow way: a solid FSC-certified oak frame, joined by hand, wrapped in heavyweight Belgian linen woven at a family mill in Flanders. Its low, open posture is made for long evenings — the kind of chair rooms are arranged around.</p>",
    careHtml:
      "<p>Vacuum upholstery with a soft brush attachment. Wipe oak with a dry cloth; treat annually with natural oil. Keep out of direct sunlight.</p>",
    sustainabilityHtml:
      "<p>Oak sourced from FSC-certified Danish and Swedish forests. Linen is OEKO-TEX Standard 100. Carbon-neutral delivery on all mainland EU orders.</p>",
    seoTitle: "Halden Linen Armchair — Solid Oak | Scandi Haven",
    seoDescription:
      "Handcrafted armchair in FSC oak and Belgian linen. Made to order in Denmark, ships in 6–8 weeks. 10-year guarantee.",
    variants: [
      { sku: "SH-HAL-ARM-OAK-SAND", material: "Oak", color: "Sand linen", colorHex: "#D9CBB3", isDefault: true, priceMinor: 129_900, stockByWarehouse: {}, imageUrls: ["/products/halden-armchair.svg", "/products/halden-armchair-2.svg"] },
      { sku: "SH-HAL-ARM-OAK-CHAR", material: "Oak", color: "Charcoal linen", colorHex: "#3E3A36", priceMinor: 129_900, stockByWarehouse: {}, imageUrls: ["/products/halden-armchair-2.svg"] },
    ],
    collections: ["autumn-collection", "hygge-edit"],
  },
  {
    slug: "oresund-table-lamp",
    title: "Øresund Table Lamp",
    categorySlug: "lighting",
    status: "active",
    leadTimeDays: [2, 4],
    weightG: 1_800,
    countryOfOrigin: "SE",
    hsCode: "9405.21",
    materials: ["Brushed brass", "Linen"],
    descriptionHtml:
      "<p>A quiet light for dark evenings. The Øresund pairs a hand-brushed brass stem with a natural linen shade that throws a soft, low glow — designed in Malmö, assembled in Copenhagen.</p>",
    careHtml: "<p>Wipe brass with a dry microfibre cloth. Avoid abrasive cleaners.</p>",
    sustainabilityHtml: "<p>Brass is 70% recycled. LED bulb included (E27, 2700 K).</p>",
    seoTitle: "Øresund Table Lamp — Brass & Linen | Scandi Haven",
    seoDescription: "Hand-brushed brass table lamp with linen shade. In stock, ships in 2–4 days.",
    variants: [
      { sku: "SH-ORE-LMP-BRS", material: "Brass", color: "Brushed brass", isDefault: true, priceMinor: 24_900, stockByWarehouse: { AAL: 24, CPH: 4 }, imageUrls: ["/products/oresund-lamp.svg"] },
      { sku: "SH-ORE-LMP-BLK", material: "Steel", color: "Matte black", colorHex: "#26241F", priceMinor: 22_900, stockByWarehouse: { AAL: 31 }, imageUrls: ["/products/oresund-lamp.svg"] },
    ],
    collections: ["hygge-edit"],
  },
  {
    slug: "hygge-wool-throw",
    title: "Hygge Wool Throw",
    categorySlug: "textiles",
    status: "active",
    isNew: true,
    leadTimeDays: [2, 4],
    weightG: 1_200,
    countryOfOrigin: "NO",
    hsCode: "6302.60",
    materials: ["Norwegian wool"],
    descriptionHtml:
      "<p>Woven from undyed Norwegian wool at a mill that has run on the same river since 1887. Heavy enough to feel held, light enough to sleep under.</p>",
    careHtml: "<p>Air outdoors rather than washing. Spot clean with wool detergent if needed.</p>",
    sustainabilityHtml: "<p>Undyed, mulesing-free wool from Norwegian family farms. Plastic-free packaging.</p>",
    seoTitle: "Hygge Wool Throw — Undyed Norwegian Wool | Scandi Haven",
    seoDescription: "Undyed Norwegian wool throw, woven since 1887. In stock, ships in 2–4 days.",
    variants: [
      { sku: "SH-HYG-THR-SND", material: "Wool", color: "Sand", isDefault: true, priceMinor: 14_900, compareAtMinor: 17_900, stockByWarehouse: { AAL: 40, CPH: 8 }, imageUrls: ["/products/hygge-throw.svg"] },
      { sku: "SH-HYG-THR-SGE", material: "Wool", color: "Sage", colorHex: "#8B9A82", priceMinor: 14_900, stockByWarehouse: { AAL: 27 }, imageUrls: ["/products/hygge-throw.svg"] },
    ],
    collections: ["hygge-edit", "autumn-collection"],
  },
  {
    slug: "woo-table-runner",
    title: "Woo Table Runner",
    categorySlug: "textiles",
    status: "active",
    leadTimeDays: [2, 4],
    weightG: 400,
    countryOfOrigin: "LT",
    hsCode: "6302.51",
    materials: ["European flax linen"],
    descriptionHtml:
      "<p>Stonewashed European flax with hand-knotted fringes. The everyday runner — dress it up, leave it creased, live on it.</p>",
    careHtml: "<p>Machine wash at 40 °C. Line dry; iron damp for a crisp finish.</p>",
    sustainabilityHtml: "<p>MASTERS OF LINEN certified flax, grown and woven in Europe.</p>",
    seoTitle: "Woo Table Runner — Stonewashed Linen | Scandi Haven",
    seoDescription: "Stonewashed linen table runner with hand-knotted fringe. In stock.",
    variants: [
      { sku: "SH-WOO-RUN-NAT", material: "Linen", color: "Natural", size: "45 × 140 cm", isDefault: true, priceMinor: 4_500, stockByWarehouse: { AAL: 80, CPH: 12 }, imageUrls: ["/products/woo-runner.svg"] },
    ],
    collections: ["autumn-collection"],
  },
  {
    slug: "birch-side-table",
    title: "Birch Side Table",
    categorySlug: "tables",
    status: "active",
    isMadeToOrder: true,
    leadTimeDays: [28, 42],
    weightG: 7_500,
    countryOfOrigin: "DK",
    hsCode: "9403.60",
    materials: ["FSC oak"],
    descriptionHtml:
      "<p>A turned oak column, a round top, nothing else. Sized to sit beside the Halden armchair with a cup and a book.</p>",
    careHtml: "<p>Wipe with a dry cloth; treat annually with natural oil.</p>",
    sustainabilityHtml: "<p>FSC-certified oak, finished with plant-based oil.</p>",
    seoTitle: "Birch Side Table — Turned Oak | Scandi Haven",
    seoDescription: "Turned solid-oak side table. Made to order in Denmark, ships in 4–6 weeks.",
    variants: [
      { sku: "SH-BIR-TBL-OAK-NAT", material: "Oak", color: "Natural", isDefault: true, priceMinor: 44_900, stockByWarehouse: {}, imageUrls: ["/products/birch-side-table.svg"] },
    ],
    collections: ["hygge-edit"],
  },
  {
    slug: "kyst-stoneware-vase",
    title: "Kyst Stoneware Vase",
    categorySlug: "ceramics",
    status: "active",
    leadTimeDays: [2, 4],
    weightG: 1_500,
    countryOfOrigin: "DK",
    hsCode: "6913.90",
    materials: ["Stoneware"],
    descriptionHtml:
      "<p>Thrown on the wheel in a Bornholm studio, glazed in a matte sea-wash. Each piece varies a little — that is the point.</p>",
    careHtml: "<p>Rinse by hand. Not dishwasher safe.</p>",
    sustainabilityHtml: "<p>Local Bornholm clay; kiln runs on certified wind electricity.</p>",
    seoTitle: "Kyst Stoneware Vase — Matte Sea-Wash Glaze | Scandi Haven",
    seoDescription: "Wheel-thrown stoneware vase from Bornholm. In stock, ships in 2–4 days.",
    variants: [
      { sku: "SH-KYS-VAS-WHT", material: "Stoneware", color: "Matte white", isDefault: true, priceMinor: 6_500, stockByWarehouse: { AAL: 55, CPH: 9 }, imageUrls: ["/products/kyst-vase.svg"] },
      { sku: "SH-KYS-VAS-BLU", material: "Stoneware", color: "Coastal blue", colorHex: "#6E7F91", priceMinor: 6_500, stockByWarehouse: { AAL: 22 }, imageUrls: ["/products/kyst-vase.svg"] },
    ],
    collections: ["autumn-collection"],
  },
];

const DEMO_CATEGORIES: Array<{ slug: string; name: string; parentSlug?: string }> = [
  { slug: "furniture", name: "Furniture" },
  { slug: "seating", name: "Seating", parentSlug: "furniture" },
  { slug: "tables", name: "Tables", parentSlug: "furniture" },
  { slug: "storage", name: "Storage", parentSlug: "furniture" },
  { slug: "beds", name: "Beds", parentSlug: "furniture" },
  { slug: "lighting", name: "Lighting" },
  { slug: "textiles", name: "Textiles" },
  { slug: "ceramics", name: "Ceramics" },
];

export async function ensureSeeded(): Promise<{ seeded: boolean }> {
  assertLocalDatabase();

  return db.transaction(async (tx) => {
    // Serialize concurrent seeders (e.g. two dev servers booting at once).
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);

    // Extensions (idempotent).
    await tx.execute(sql`CREATE EXTENSION IF NOT EXISTS citext`);
    await tx.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // ---- Warehouses (PRD §7.3: AAL + CPH showroom floor) ----
    await tx
      .insert(warehouse)
      .values([
        { code: "AAL", name: "Aalborg Warehouse", isShowroom: false },
        { code: "CPH", name: "Copenhagen Showroom Floor", isShowroom: true },
      ])
      .onConflictDoNothing();

    // ---- FX rates (PRD §7.8) ----
    await tx
      .insert(fxRate)
      .values([
        { currency: "USD", rate: "1.08640000" },
        { currency: "GBP", rate: "0.85230000" },
        { currency: "DKK", rate: "7.46390000" },
        { currency: "SEK", rate: "11.24800000" },
      ])
      .onConflictDoNothing();

    // ---- Media ----
    await tx.insert(media).values(DEMO_MEDIA).onConflictDoNothing();

    // ---- Categories ----
    for (const cat of DEMO_CATEGORIES) {
      await tx
        .insert(category)
        .values({
          slug: cat.slug,
          name: cat.name,
          ...(cat.parentSlug
            ? {}
            : { sortOrder: DEMO_CATEGORIES.indexOf(cat) }),
        })
        .onConflictDoNothing();
    }
    const allCategories = await tx.select({ id: category.id, slug: category.slug }).from(category);
    const categoryIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
    for (const cat of DEMO_CATEGORIES) {
      if (!cat.parentSlug) continue;
      const parentId = categoryIdBySlug.get(cat.parentSlug);
      const id = categoryIdBySlug.get(cat.slug);
      if (parentId && id) {
        await tx.update(category).set({ parentId }).where(sql`${category.id} = ${id}`);
      }
    }

    // ---- Products, variants, prices, inventory, images ----
    for (const [index, p] of DEMO_PRODUCTS.entries()) {
      const categoryId = categoryIdBySlug.get(p.categorySlug);
      await tx
        .insert(product)
        .values({
          slug: p.slug,
          title: p.title,
          descriptionHtml: p.descriptionHtml,
          status: p.status,
          categoryId: categoryId ?? null,
          countryOfOrigin: p.countryOfOrigin,
          hsCode: p.hsCode,
          leadTimeDaysMin: p.leadTimeDays[0],
          leadTimeDaysMax: p.leadTimeDays[1],
          isNew: p.isNew ?? false,
          isPreorder: false,
          materials: p.materials,
          careHtml: p.careHtml,
          sustainabilityHtml: p.sustainabilityHtml,
          weightG: p.weightG,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          sortOrder: index,
        })
        .onConflictDoNothing();
    }

    const allProducts = await tx.select({ id: product.id, slug: product.slug }).from(product);
    const productIdBySlug = new Map(allProducts.map((row) => [row.slug, row.id]));
    const warehouseRows = await tx.select({ id: warehouse.id, code: warehouse.code }).from(warehouse);
    const warehouseIdByCode = new Map(warehouseRows.map((w) => [w.code, w.id]));

    for (const p of DEMO_PRODUCTS) {
      const productId = productIdBySlug.get(p.slug);
      if (!productId) continue;

      const productMedia = DEMO_MEDIA.filter((m) =>
        p.variants.some((v) => v.imageUrls.includes(m.url)),
      );
      for (const [sort, m] of productMedia.entries()) {
        await tx
          .insert(productImage)
          .values({ productId, mediaId: m.id, sortOrder: sort })
          .onConflictDoNothing();
      }

      for (const v of p.variants) {
        await tx
          .insert(productVariant)
          .values({
            productId,
            sku: v.sku,
            material: v.material,
            color: v.color,
            colorHex: v.colorHex,
            size: v.size,
            isDefault: v.isDefault ?? false,
            isActive: true,
            weightG: p.weightG,
          })
          .onConflictDoNothing();
      }

      const variantRows = await tx
        .select({ id: productVariant.id, sku: productVariant.sku })
        .from(productVariant);
      const variantIdBySku = new Map(variantRows.map((row) => [row.sku, row.id]));

      for (const v of p.variants) {
        const variantId = variantIdBySku.get(v.sku);
        if (!variantId) continue;

        await tx
          .insert(variantPrice)
          .values({
            variantId,
            currency: "EUR",
            amount: v.priceMinor,
            compareAt: v.compareAtMinor ?? null,
          })
          .onConflictDoNothing();

        for (const m of DEMO_MEDIA.filter((m) => v.imageUrls.includes(m.url))) {
          await tx
            .insert(variantImage)
            .values({ variantId, mediaId: m.id, sortOrder: 0 })
            .onConflictDoNothing();
        }

        // Made-to-order variants carry no stock rows: always purchasable (PRD §7.6).
        for (const [code, qty] of Object.entries(v.stockByWarehouse)) {
          const warehouseId = warehouseIdByCode.get(code);
          if (!warehouseId) continue;
          await tx
            .insert(inventoryLevel)
            .values({
              variantId,
              warehouseId,
              qtyOnHand: qty,
              safetyStock: 2,
            })
            .onConflictDoNothing();
        }
      }
    }

    // ---- Collections ----
    await tx
      .insert(collection)
      .values([
        {
          slug: "hygge-edit",
          title: "The Hygge Edit",
          subtitle: "Pieces for long evenings and short days",
          storyHtml:
            "<p>Hygge is not a style; it is a posture toward winter. These are the pieces our own studio reaches for when the light goes low — wool, warm brass, turned oak, and a chair worth sitting in past midnight.</p>",
        },
        {
          slug: "autumn-collection",
          title: "Autumn Collection",
          subtitle: "New work for the dark season",
        },
      ])
      .onConflictDoNothing();

    const allCollections = await tx.select({ id: collection.id, slug: collection.slug }).from(collection);
    const collectionIdBySlug = new Map(allCollections.map((c) => [c.slug, c.id]));
    for (const p of DEMO_PRODUCTS) {
      for (const colSlug of p.collections) {
        const collectionId = collectionIdBySlug.get(colSlug);
        const productId = productIdBySlug.get(p.slug);
        if (collectionId && productId) {
          await tx
            .insert(collectionProduct)
            .values({ collectionId, productId })
            .onConflictDoNothing();
        }
      }
    }

    // ---- Shipping zones & rates (PRD FR-507) ----
    const zoneCount = await tx.select({ id: shippingZone.id }).from(shippingZone);
    if (zoneCount.length === 0) {
      const zones = await tx
        .insert(shippingZone)
        .values([
          { name: "European Union", region: "EU", countries: ["DK", "DE", "SE", "NL", "FR", "IT", "ES", "PL", "AT", "BE", "FI"] },
          { name: "United States", region: "US", countries: ["US"] },
          { name: "United Kingdom", region: "UK", countries: ["GB"] },
        ])
        .returning({ id: shippingZone.id, region: shippingZone.region });
      const zoneByRegion = new Map(zones.map((z) => [z.region, z.id]));
      const rates: (typeof shippingRate.$inferInsert)[] = [];
      for (const [region, zoneId] of zoneByRegion) {
        const eur = region === "EU" ? "EUR" : region === "US" ? "USD" : "GBP";
        const factor = region === "EU" ? 1 : region === "US" ? 1.3 : 1.2;
        rates.push(
          { zoneId, method: "standard", maxWeightG: 5_000, amount: Math.round(4_900 * factor), currency: eur, etaDaysMin: 2, etaDaysMax: 5 },
          { zoneId, method: "express", maxWeightG: 5_000, amount: Math.round(12_900 * factor), currency: eur, etaDaysMin: 1, etaDaysMax: 2 },
          { zoneId, method: "standard", minWeightG: 5_001, maxWeightG: 30_000, amount: Math.round(14_900 * factor), currency: eur, etaDaysMin: 3, etaDaysMax: 7 },
          { zoneId, method: "white_glove", minWeightG: 30_001, amount: Math.round(39_900 * factor), currency: eur, etaDaysMin: 5, etaDaysMax: 10 },
          { zoneId, method: "pickup", amount: 0, currency: eur, etaDaysMin: 0, etaDaysMax: 1 },
        );
      }
      await tx.insert(shippingRate).values(rates);
    }

    // ---- Promotions (PRD FR-810) ----
    await tx.execute(sql`
      INSERT INTO promotion (code, kind, value, conditions_json, is_active)
      VALUES ('WELCOME100', 'fixed', 10000, '{"minSpendMinor": 50000}', true)
      ON CONFLICT (code) DO NOTHING
    `);

    // ---- Static pages (PRD FR-704) ----
    await tx
      .insert(staticPage)
      .values([
        {
          slug: "our-story",
          title: "Our Story",
          bodyHtml:
            "<p>Scandi Haven began in a small Aalborg workshop in 2016 with one bench, two makers, and a stubborn belief: furniture should be made slowly, from honest material, to be kept for decades. Today we work with a small family of joiners, weavers, and potters across Denmark, Sweden, and Norway — and we still sign every piece we make.</p>",
          isPublished: true,
        },
        {
          slug: "privacy",
          title: "Privacy Policy",
          bodyHtml:
            "<p>We collect the minimum personal data required to fulfil your order and, with your consent, to send you our journal and offers. See PRD §9.5 for the lawful-basis matrix governing each category. You may request export or deletion of your data at any time via your account or by contacting privacy@scandihaven.example.</p>",
          isPublished: true,
        },
        {
          slug: "terms",
          title: "Terms of Sale",
          bodyHtml:
            "<p>Orders are an offer to purchase; the contract forms when we confirm dispatch. Made-to-order pieces carry the lead time shown on the product page at purchase. Statutory withdrawal rights apply (14 days EU/UK; made-to-order items excluded from cancellation once production begins, per Directive 2011/83/EU art. 38(3)).</p>",
          isPublished: true,
        },
        {
          slug: "shipping",
          title: "Shipping",
          bodyHtml:
            "<p>In-stock items ship from our Aalborg warehouse within 3 business days. Made-to-order furniture ships within the lead time shown at purchase. Large pieces (over 30 kg) travel white-glove by default. Pickup at our Copenhagen showroom is always free.</p>",
          isPublished: true,
        },
        {
          slug: "returns",
          title: "Returns",
          bodyHtml:
            "<p>You may return in-stock items within 14 days of delivery, unworn and in original packaging — start a return from your account or the returns portal. Made-to-order and personalised pieces are excluded unless faulty. Damaged goods: photograph the packaging and item on arrival; we collect and replace at our cost.</p>",
          isPublished: true,
        },
      ])
      .onConflictDoNothing();

    // ---- Navigation (PRD FR-101/103) ----
    await tx
      .insert(navEntry)
      .values([
        { menu: "header", label: "Shop", href: "/shop", sortOrder: 0 },
        { menu: "header", label: "Collections", href: "/collections", sortOrder: 1 },
        { menu: "header", label: "Our Story", href: "/our-story", sortOrder: 2 },
        { menu: "header", label: "Journal", href: "/journal", sortOrder: 3 },
        { menu: "footer_help", label: "Shipping", href: "/shipping", sortOrder: 0 },
        { menu: "footer_help", label: "Returns", href: "/returns", sortOrder: 1 },
        { menu: "footer_help", label: "FAQ", href: "/faq", sortOrder: 2 },
        { menu: "footer_about", label: "Our Story", href: "/our-story", sortOrder: 0 },
        { menu: "footer_about", label: "Privacy", href: "/privacy", sortOrder: 1 },
        { menu: "footer_about", label: "Terms", href: "/terms", sortOrder: 2 },
      ])
      .onConflictDoNothing();

    // ---- Announcement (PRD FR-108) ----
    await tx.insert(announcement).values({
      message: "The Autumn Collection is here — handcrafted pieces, made to order.",
      href: "/collections/autumn-collection",
      sortOrder: 0,
    });

    // ---- Search synonyms (PRD FR-105) ----
    await tx
      .insert(searchSynonym)
      .values([
        { term: "couch", synonym: "sofa" },
        { term: "lamp", synonym: "lighting" },
        { term: "rug", synonym: "throw" },
      ])
      .onConflictDoNothing();

    // ---- Journal (PRD FR-703) ----
    await tx
      .insert(journalPost)
      .values([
        {
          slug: "the-slow-chair",
          title: "The Slow Chair",
          excerpt: "Why the Halden takes eight weeks, and why we will not make it faster.",
          category: "craft",
          author: "Studio Journal",
          bodyHtml:
            "<p>Eight weeks sounds like a long time for a chair. It is about 30 hours of making, and 46 days of waiting for oak to tell you it is ready. This is the story of what happens in between.</p>",
          isPublished: true,
          relatedProductIds: [],
        },
        {
          slug: "wool-that-remembers-water",
          title: "Wool That Remembers Water",
          excerpt: "A visit to the mill on the river — where the Hygge throw is woven.",
          category: "people",
          author: "Studio Journal",
          bodyHtml:
            "<p>The mill has run on the same river since 1887. The current turns nothing now but the meter, yet the water still sets the rules: humidity, dye baths, drying times.</p>",
          isPublished: true,
          relatedProductIds: [],
        },
      ])
      .onConflictDoNothing();

    return { seeded: true };
  });
}
