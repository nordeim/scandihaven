import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { collection, collectionProduct } from "@scandihaven/db/schema";
import { listProducts } from "@scandihaven/commerce/catalog";
import { sanitizeRichText } from "@scandihaven/commerce/rich-text";
import { ProductCard } from "@scandihaven/ui/product-card";
import { formatMinor } from "@/lib/format";

type Params = Promise<{ slug: string }>;

export const revalidate = 300;

async function getCollection(slug: string) {
  const rows = await db
    .select()
    .from(collection)
    .where(and(eq(collection.slug, slug), eq(collection.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const col = await getCollection(slug).catch((error: unknown) => { console.error("[collection] load failed", error); return null; });
  return col
    ? { title: col.title, description: col.subtitle ?? undefined }
    : { title: "Collection not found" };
}

/** Collection page (PRD FR-702): editorial header + product grid. */
export default async function CollectionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const col = await getCollection(slug);
  if (!col) notFound();

  const productIds = await db
    .select({ productId: collectionProduct.productId })
    .from(collectionProduct)
    .where(eq(collectionProduct.collectionId, col.id));
  const ids = productIds.map((r) => r.productId);

  // Members are filtered in SQL via the schema-validated ids filter
  // (audit 2026-09-09 M-COL — the previous 48-cap + JS filter silently
  // dropped collection members beyond the sort window).
  const result =
    ids.length > 0
      ? await listProducts({ region: "EU", ids })
      : { items: [] as Awaited<ReturnType<typeof listProducts>>["items"] };
  const items = result.items;

  return (
    <div>
      <section className="border-b border-line bg-bg-2">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/collections" className="hover:text-accent-2">
              Collections
            </Link>
            <span aria-hidden> / </span>
            <span className="text-ink">{col.title}</span>
          </nav>
          <h1 className="mt-6 font-display text-4xl md:text-5xl">{col.title}</h1>
          {col.subtitle ? <p className="mt-3 text-lg text-ink-2">{col.subtitle}</p> : null}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        {col.storyHtml ? (
          <div
            className="prose-sm max-w-2xl leading-relaxed text-ink-2"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(col.storyHtml) }}
          />
        ) : null}
        {items.length === 0 ? (
          <p className="mt-10 text-md text-muted">Pieces are being added to this collection.</p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                formattedPrice={formatMinor(product.priceMinor, product.currency)}
                formattedCompareAt={
                  product.compareAtMinor ? formatMinor(product.compareAtMinor, product.currency) : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
