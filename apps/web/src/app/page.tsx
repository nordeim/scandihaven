import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { listApprovedTestimonials, listFeaturedCategories, listLatestJournal, listProducts } from "@scandihaven/commerce/catalog";
import { ProductCard } from "@scandihaven/ui/product-card";
import { buttonVariants } from "@scandihaven/ui/button";
import { Skeleton } from "@scandihaven/ui/skeleton";
import { NewsletterForm } from "@/components/newsletter-form";
import { StarsRating } from "@/components/stars-rating";
import { publicPageMetadata } from "@/lib/seo";
import { formatMinor } from "@/lib/format";

// Canonical + per-page og:url (round 5, R5-2, FR-313).
export const metadata: Metadata = publicPageMetadata({ path: "/" });

/**
 * Homepage (PRD FR-701): announcement bar lives in the header; this page renders
 * hero → trust marquee → featured categories → new arrivals → brand story →
 * materials → editorial block → testimonials → journal preview → newsletter.
 * Every section degrades to hidden (never a blank block) when its content is
 * missing.
 */
export default async function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero — editorial split (FR-701 §2) */}
      <section className="border-b border-line bg-bg-2">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28">
          <div className="reveal">
            <p className="text-sm uppercase tracking-[0.2em] text-accent-2">
              Handcrafted in Northern Europe
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight text-ink md:text-6xl">
              Slow living, beautifully made.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
              Furniture, lighting and textiles made the slow way — solid FSC oak,
              Belgian linen, Norwegian wool. Built to be kept for decades.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className={buttonVariants({ size: "lg" })}>
                Shop the collection
              </Link>
              <Link href="/our-story" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Our story
              </Link>
            </div>
          </div>
          <div className="reveal aspect-[4/3] overflow-hidden rounded-image bg-bg-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/products/halden-armchair.svg"
              alt="Halden linen armchair in oak with sand upholstery"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Trust marquee (FR-701 §3) */}
      <section aria-label="Our promises" className="border-b border-line">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 text-center text-sm text-ink-2 md:grid-cols-4 md:px-8">
          <p>Handcrafted to order</p>
          <p>FSC-certified oak</p>
          <p>Carbon-neutral delivery</p>
          <p>10-year guarantee</p>
        </div>
      </section>

      {/* Featured categories (FR-701 §4) */}
      <section className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <h2 className="font-display text-3xl">Shop by category</h2>
        <Suspense fallback={<Skeleton className="mt-8 h-64" />}>
          <CategoryTiles />
        </Suspense>
      </section>

      {/* New arrivals (FR-701 §5) */}
      <section className="border-y border-line bg-bg-2">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-3xl">New arrivals</h2>
            <Link href="/shop?sort=newest" className="text-sm text-accent-2 hover:underline">
              View all
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
            <NewArrivals />
          </Suspense>
        </div>
      </section>

      {/* Brand story teaser (FR-701 §6; round 8, R8-5) */}
      <section className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-accent-2">Our story</p>
            <h2 className="mt-4 font-display text-3xl md:text-4xl">
              A workshop, a river, and no hurry
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-2">
              We design in Aalborg, work with mills and joineries we can visit in
              a morning, and let oak decide its own timeline. Ten-year guarantees
              are easy to give when you build this way.
            </p>
            <Link
              href="/our-story"
              className={buttonVariants({ variant: "outline" }) + " mt-6 inline-block"}
            >
              Read our story
            </Link>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-image bg-bg-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/products/birch-side-table.svg"
              alt="Birch side table in the Aalborg workshop"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Materials (FR-701 §7; round 8, R8-5) */}
      <section className="border-y border-line bg-bg-2">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
          <h2 className="font-display text-3xl">Materials we trust</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "FSC oak",
                copy: "Solid, certified, and finished with natural oil — never a veneer in sight.",
              },
              {
                name: "Belgian linen",
                copy: "Woven at a family mill in Flanders, OEKO-TEX Standard 100 certified.",
              },
              {
                name: "Norwegian wool",
                copy: "Long-fibre wool that breathes in summer and holds warmth in winter.",
              },
            ].map((material) => (
              <Link
                key={material.name}
                href="/materials"
                className="rounded-card border border-line bg-bg p-6 transition-colors hover:border-accent"
              >
                <h3 className="font-display text-xl">{material.name}</h3>
                <p className="mt-2 text-md leading-relaxed text-ink-2">{material.copy}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Editorial collection block — dark (FR-701 §8) */}
      <section className="bg-dark text-bg">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 md:grid-cols-2 md:px-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-wood">The Hygge Edit</p>
            <h2 className="mt-4 font-display text-3xl md:text-4xl">
              Pieces for long evenings and short days
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-bg/80">
              Hygge is not a style; it is a posture toward winter. Wool, warm brass,
              turned oak — and a chair worth sitting in past midnight.
            </p>
            <Link
              href="/collections/hygge-edit"
              className={buttonVariants({ size: "lg", variant: "secondary" }) + " mt-6 inline-block"}
            >
              Explore the edit
            </Link>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-image bg-dark-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/products/hygge-edit.svg"
              alt="The Hygge Edit — warm living room scene in evening light"
              className="h-full w-full object-cover opacity-90"
            />
          </div>
        </div>
      </section>

      {/* Testimonials (FR-701 §9; round 8, R8-5) */}
      <section className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <Suspense fallback={<Skeleton className="mt-8 h-64" />}>
          <Testimonials />
        </Suspense>
      </section>

      {/* Journal preview (FR-701 §10) */}
      <section className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <h2 className="font-display text-3xl">From the journal</h2>
        <Suspense fallback={<Skeleton className="mt-8 h-48" />}>
          <JournalPreview />
        </Suspense>
      </section>

      {/* Newsletter (FR-701 §11) */}
      <section className="border-t border-line bg-bg-2">
        <div className="mx-auto max-w-xl px-5 py-16 text-center md:px-8">
          <h2 className="font-display text-2xl">Slow letters, four times a year</h2>
          <p className="mt-2 text-md text-ink-2">
            New pieces, workshop stories, and early access to seasonal collections.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}

async function CategoryTiles() {
  const categories = await listFeaturedCategories().catch((error: unknown) => { console.error("[home] categories load failed", error); return [] as never; });
  if (categories.length === 0) return null;
  return (
    <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/shop/${category.slug}`}
          className="group rounded-card border border-line bg-bg p-6 transition-colors hover:border-accent"
        >
          <p className="font-display text-xl group-hover:text-accent-2">{category.name}</p>
        </Link>
      ))}
    </div>
  );
}

async function NewArrivals() {
  const result = await listProducts({ sort: "newest", pageSize: 8, region: "EU" }).catch((error: unknown) => { console.error("[home] new arrivals load failed", error); return null; });
  if (!result || result.items.length === 0) {
    return <p className="mt-8 text-md text-muted">New pieces are on the bench — check back soon.</p>;
  }
  return (
    <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
      {result.items.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          formattedPrice={formatMinor(product.priceMinor, product.currency)}
          formattedCompareAt={
            product.compareAtMinor ? formatMinor(product.compareAtMinor, product.currency) : null
          }
          priority={index < 2}
        />
      ))}
    </div>
  );
}

async function Testimonials() {
  const testimonials = await listApprovedTestimonials(3).catch((error: unknown) => { console.error("[home] testimonials load failed", error); return [] as never; });
  if (testimonials.length === 0) return null;
  return (
    <div>
      <h2 className="font-display text-3xl">What customers say</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {testimonials.map((t) => (
          <figure key={`${t.productSlug}-${t.authorName}`} className="flex flex-col rounded-card border border-line p-6">
            <StarsRating rating={t.rating} />
            <blockquote className="mt-3 flex-1 text-md leading-relaxed text-ink-2">
              {t.title ? <span className="block font-medium text-ink">{t.title}</span> : null}
              {t.body}
            </blockquote>
            <figcaption className="mt-4 text-sm text-muted">
              {t.authorName} —{" "}
              <Link href={`/products/${t.productSlug}`} className="text-accent-2 hover:underline">
                {t.productTitle}
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

async function JournalPreview() {
  const posts = await listLatestJournal(3).catch((error: unknown) => { console.error("[home] journal load failed", error); return [] as never; });
  if (posts.length === 0) return null;
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      {posts.map((post) => (
        // R8-2 (live audit round 8): the reader routes shipped in round 7 —
        // link each preview card to its category-scoped route
        // (/journal/{category}/{slug}, the R7-2 URL contract).
        <Link
          key={post.slug}
          href={`/journal/${post.category}/${post.slug}`}
          className="rounded-card border border-line p-6 transition-colors hover:border-accent"
        >
          <p className="text-xs uppercase tracking-wide text-muted">{post.category}</p>
          <h3 className="mt-2 font-display text-xl">{post.title}</h3>
          <p className="mt-2 text-md text-ink-2">{post.excerpt}</p>
        </Link>
      ))}
    </div>
  );
}
