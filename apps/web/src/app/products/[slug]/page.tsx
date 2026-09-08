import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@scandihaven/commerce/catalog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@scandihaven/ui/accordion";
import { StarsRating } from "@/components/stars-rating";
import { ProductBuyPanel } from "@/components/product-buy-panel";

type Params = Promise<{ slug: string }>;

export const revalidate = 300; // ISR per PRD §4.4; tag-invalidated on catalog mutation

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  if (!product) return { title: "Product not found" };
  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.seoTitle ?? product.title,
      description: product.seoDescription ?? undefined,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

/**
 * PDP (PRD FR-301..313): gallery, variant panel, accordions, cross-sell stub,
 * JSON-LD structured data, breadcrumbs. Reviews and accordions stream below.
 */
export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  if (!defaultVariant) notFound();

  const leadTime = { min: 2, max: 4 }; // overridden per-variant on selection (client panel)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.seoDescription ?? product.descriptionHtml ?? undefined,
    material: product.materials.join(", "),
    sku: defaultVariant.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: (defaultVariant.priceMinor / 100).toFixed(2),
      availability:
        defaultVariant.availability === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
    ...(product.ratingCount > 0 && product.ratingAverage !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage.toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <script
        type="application/ld+json"
        // JSON-LD is server-generated structured data (PRD FR-312), not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-accent-2">
          Home
        </Link>
        <span aria-hidden> / </span>
        <Link href="/shop" className="hover:text-accent-2">
          Shop
        </Link>
        {product.categoryName ? (
          <>
            <span aria-hidden> / </span>
            <Link href="/shop" className="hover:text-accent-2">
              {product.categoryName}
            </Link>
          </>
        ) : null}
        <span aria-hidden> / </span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-2">
        {/* Gallery (FR-301) */}
        <div className="flex flex-col gap-4">
          <div className="aspect-[4/5] overflow-hidden rounded-image bg-bg-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images[0]?.url ?? "/products/placeholder.svg"}
              alt={product.images[0]?.alt ?? product.title}
              className="h-full w-full object-cover"
              fetchPriority="high"
            />
          </div>
          {product.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {product.images.slice(1, 5).map((image) => (
                <div key={image.url} className="aspect-square overflow-hidden rounded-image bg-bg-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Buy panel (client island — variant state, FR-302..305) */}
        <ProductBuyPanel
          product={{
            id: product.id,
            title: product.title,
            materials: product.materials,
            leadTimeDaysMin: leadTime.min,
            leadTimeDaysMax: leadTime.max,
          }}
          variants={product.variants}
          currency={product.currency}
        />
      </div>

      {/* Content accordions (FR-306) */}
      <div className="mx-auto mt-16 max-w-3xl">
        <Accordion type="single" collapsible>
          <AccordionItem value="description">
            <AccordionTrigger>Description</AccordionTrigger>
            <AccordionContent>
              <div
                className="prose-sm leading-relaxed"
                // Admin-authored rich text rendered after sanitization (PRD §9.4).
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml ?? "" }}
              />
            </AccordionContent>
          </AccordionItem>
          {product.careHtml ? (
            <AccordionItem value="care">
              <AccordionTrigger>Materials & care</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2 text-sm text-muted">{product.materials.join(" · ")}</p>
                <div
                  className="leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: product.careHtml }}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}
          {product.sustainabilityHtml ? (
            <AccordionItem value="sustainability">
              <AccordionTrigger>Sustainability</AccordionTrigger>
              <AccordionContent>
                <div
                  className="leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: product.sustainabilityHtml }}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}
          <AccordionItem value="shipping">
            <AccordionTrigger>Shipping & returns</AccordionTrigger>
            <AccordionContent>
              <p>
                In-stock pieces ship from Aalborg within 3 business days. Made-to-order pieces
                follow the lead time shown at purchase. 14-day returns on in-stock items.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Reviews (FR-308) */}
      {product.reviews.length > 0 ? (
        <section className="mx-auto mt-16 max-w-3xl" aria-label="Customer reviews">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl">Reviews</h2>
            <StarsRating rating={product.ratingAverage ?? 0} />
            <span className="text-sm text-muted">
              {product.ratingCount} {product.ratingCount === 1 ? "review" : "reviews"}
            </span>
          </div>
          <ul className="mt-6 space-y-6">
            {product.reviews.slice(0, 6).map((review) => (
              <li key={review.id} className="rounded-card border border-line p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{review.authorName}</p>
                  <StarsRating rating={review.rating} small />
                </div>
                {review.title ? <p className="mt-1 font-medium text-ink-2">{review.title}</p> : null}
                <p className="mt-2 text-md leading-relaxed text-ink-2">{review.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
