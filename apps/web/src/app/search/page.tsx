import Link from "next/link";
import type { Metadata } from "next";
import {
  listFeaturedCategories,
  listProducts,
  productQuerySchema,
} from "@scandihaven/commerce/catalog";
import { ProductCard } from "@scandihaven/ui/product-card";
import { Button } from "@scandihaven/ui/button";
import { formatMinor } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Scandi Haven catalog.",
  // PRD §11.1: search pages are excluded from indexing.
  robots: { index: false },
};

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
] as const;

function pick(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * Search results (PRD FR-106, §11.1; live E2E audit 2026-09-10 round 4,
 * R4-5): server-rendered product grid over `listProducts({ search })` with a
 * shareable URL (`?q=&sort=&page=`), an honest empty state with onward
 * guidance, and `noindex`. The header search affordance (typeahead UI) is a
 * separate deferred surface (FR-104, traceability).
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawQuery = pick(params.q) ?? "";
  const trimmed = rawQuery.trim().slice(0, 120);

  const parsed = productQuerySchema.safeParse({
    sort: pick(params.sort) ?? "featured",
    page: pick(params.page) ?? 1,
    availability: "all",
    search: trimmed.length >= 2 ? trimmed : undefined,
    region: "EU",
  });
  const query = parsed.success ? parsed.data : productQuerySchema.parse({ search: undefined });

  const [result, categories] = await Promise.all([
    trimmed.length >= 2
      ? listProducts(query)
      : Promise.resolve({ items: [], total: 0, page: 1, pageCount: 0 }),
    listFeaturedCategories().catch((error: unknown) => {
      console.error("[search] categories load failed", error);
      return [] as never;
    }),
  ]);

  const hrefWith = (next: Record<string, string>) => {
    const sp = new URLSearchParams({ q: trimmed });
    if (query.sort !== "featured") sp.set("sort", query.sort);
    if (result.page > 1) sp.set("page", String(result.page));
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    return `/search?${sp.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-accent-2">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">Search</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl">
          Search{trimmed ? <span className="text-muted"> — “{trimmed}”</span> : null}
        </h1>
        {trimmed.length >= 2 ? (
          <p className="text-sm text-muted" role="status">
            {result.total} {result.total === 1 ? "result" : "results"}
          </p>
        ) : null}
      </div>

      {trimmed.length < 2 ? (
        <div className="mt-16 rounded-card border border-line p-16 text-center">
          <p className="font-display text-2xl">What are you looking for?</p>
          <p className="mt-2 text-md text-muted">
            Type at least two characters in the search field — or browse the shop by category.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/shop">
              <Button variant="secondary">Browse the shop</Button>
            </Link>
          </div>
        </div>
      ) : result.items.length === 0 ? (
        <div className="mt-16 rounded-card border border-line p-16 text-center">
          <p className="font-display text-2xl">No results for “{trimmed}”</p>
          <p className="mt-2 text-md text-muted">
            Check the spelling, try a broader term, or browse the shop.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/shop">
              <Button variant="secondary">Browse the shop</Button>
            </Link>
            {categories.slice(0, 4).map((category) => (
              <Link key={category.slug} href={`/shop/${category.slug}`}>
                <Button variant="outline">{category.name}</Button>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Sort products">
            {SORTS.map((sort) => (
              <Link
                key={sort.value}
                href={hrefWith({ sort: sort.value === "featured" ? "" : sort.value, page: "" })}
                aria-current={query.sort === sort.value ? "true" : undefined}
                data-sort={sort.value}
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

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {result.items.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                formattedPrice={formatMinor(product.priceMinor, product.currency)}
                formattedCompareAt={
                  product.compareAtMinor
                    ? formatMinor(product.compareAtMinor, product.currency)
                    : null
                }
                priority={index < 4}
              />
            ))}
          </div>

          {result.pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-14 flex justify-center gap-2">
              {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((page) => (
                <Link
                  key={page}
                  href={hrefWith({ page: page > 1 ? String(page) : "" })}
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
        </>
      )}
    </div>
  );
}
