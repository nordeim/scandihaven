import Link from "next/link";
import type { Metadata } from "next";
import { listProducts, productQuerySchema } from "@scandihaven/commerce/catalog";
import { safeJsonLd } from "@scandihaven/commerce/rich-text";
import { ProductCard } from "@scandihaven/ui/product-card";
import { Button } from "@scandihaven/ui/button";
import { breadcrumbJsonLd, publicPageMetadata } from "@/lib/seo";
import { currentSiteUrl } from "@/lib/site-origin";
import { formatMinor } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Canonical + per-page og:url (round 5, R5-2, FR-313).
export const metadata: Metadata = publicPageMetadata({
  path: "/shop",
  title: "Shop all",
  description:
    "Handcrafted furniture, lighting, textiles and ceramics — made to order in Northern Europe.",
});

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
] as const;

function pick(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/** PLP (PRD FR-201..208): server-rendered grid, crawlable pagination, URL-persisted sort. */
export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const parsed = productQuerySchema.safeParse({
    sort: pick(params.sort) ?? "featured",
    page: pick(params.page) ?? 1,
    availability: pick(params.availability) ?? "all",
    search: pick(params.q),
    region: "EU",
  });

  const query = parsed.success ? parsed.data : productQuerySchema.parse({});
  const result = await listProducts(query);

  const sortHref = (sort: string) => {
    const next = new URLSearchParams();
    next.set("sort", sort);
    if (query.search) next.set("q", query.search);
    return `/shop?${next.toString()}`;
  };

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    next.set("sort", query.sort);
    next.set("page", String(page));
    if (query.search) next.set("q", query.search);
    return `/shop?${next.toString()}`;
  };

  // FR-201 (round 8, R8-3): the PLP breadcrumb mirrors the visible trail —
  // previously only the PDP emitted BreadcrumbList structured data.
  const crumbs = breadcrumbJsonLd(await currentSiteUrl(), [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <script
        type="application/ld+json"
        // Same escaping rule as the PDP (safeJsonLd, audit 2026-09-09 H-2).
        dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-accent-2">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">Shop</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl">Shop all</h1>
        <p className="text-sm text-muted" role="status">
          {result.total} {result.total === 1 ? "piece" : "pieces"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Sort products">
        {SORTS.map((sort) => (
          <Link
            key={sort.value}
            href={sortHref(sort.value)}
            aria-current={query.sort === sort.value ? "true" : undefined}
            className={`inline-flex h-9 items-center rounded-pill px-3 text-sm transition-colors ${
              query.sort === sort.value
                ? "bg-accent-2 text-white"
                : "border border-line text-ink-2 hover:bg-bg-2"
            }`}
          >
            {sort.label}
          </Link>
        ))}
      </div>

      {result.items.length === 0 ? (
        <div className="mt-16 rounded-card border border-line p-16 text-center">
          <p className="font-display text-2xl">Nothing matches those filters</p>
          <p className="mt-2 text-md text-muted">
            Try removing a filter, or browse everything in the shop.
          </p>
          <Link href="/shop" className="mt-6 inline-block">
            <Button variant="secondary">Clear filters</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          {result.items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              formattedPrice={formatMinor(product.priceMinor, product.currency)}
              formattedCompareAt={
                product.compareAtMinor ? formatMinor(product.compareAtMinor, product.currency) : null
              }
              priority={index < 4}
            />
          ))}
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-14 flex justify-center gap-2">
          {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={pageHref(page)}
              aria-current={page === result.page ? "page" : undefined}
              className={`flex h-10 w-10 items-center justify-center rounded-card border text-sm ${
                page === result.page
                  ? "border-accent-2 bg-accent-2 text-white"
                  : "border-line text-ink-2 hover:bg-bg-2"
              }`}
            >
              {page}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
