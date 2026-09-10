import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProducts, productQuerySchema, hasActiveCategory } from "@scandihaven/commerce/catalog";
import { ProductCard } from "@scandihaven/ui/product-card";
import { publicPageMetadata } from "@/lib/seo";
import { formatMinor } from "@/lib/format";

type Params = Promise<{ category: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params;
  const name = category.charAt(0).toUpperCase() + category.slice(1);
  // Canonical + per-page og:url (round 5, R5-2): previously this canonical
  // bound to the build-time localhost fallback on deployments without
  // NEXT_PUBLIC_SITE_URL; the builder resolves against the layout's
  // request-scoped metadataBase.
  return publicPageMetadata({
    path: `/shop/${category}`,
    title: name,
    description: `Handcrafted ${category} — made to order in Northern Europe.`,
  });
}

/** Category PLP (PRD FR-201): /shop/{category} with subtree products. */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { category: categorySlug } = await params;
  const search = await searchParams;

  // Known-active categories ALWAYS render (round 5, R5-3): the sitemap lists
  // every active category, so a product-less one must resolve with its empty
  // state — previously `result.total === 0` 404'd them, making 2/20 sitemap
  // URLs dead and the empty-state branch below unreachable. Unknown or
  // inactive slugs still 404 (FR-201: only UNKNOWN slugs are not found).
  if (!(await hasActiveCategory(categorySlug))) {
    notFound();
  }

  const parsed = productQuerySchema.safeParse({
    categorySlug,
    sort: pick(search.sort) ?? "featured",
    page: pick(search.page) ?? 1,
    region: "EU",
  });
  const query = parsed.success ? parsed.data : productQuerySchema.parse({ categorySlug });
  const result = await listProducts(query);

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-accent-2">
          Home
        </Link>
        <span aria-hidden> / </span>
        <Link href="/shop" className="hover:text-accent-2">
          Shop
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{categorySlug}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl capitalize">{categorySlug}</h1>
        <p className="text-sm text-muted" role="status">
          {result.total} {result.total === 1 ? "piece" : "pieces"}
        </p>
      </div>

      {result.items.length === 0 ? (
        <p className="mt-16 text-md text-muted">No pieces here yet — new work lands each season.</p>
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
              href={`/shop/${categorySlug}?page=${page}&sort=${query.sort}`}
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
