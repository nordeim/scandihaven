import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJournalPost, listProducts } from "@scandihaven/commerce/catalog";
import { safeJsonLd, sanitizeRichText } from "@scandihaven/commerce/rich-text";
import { ProductCard } from "@scandihaven/ui/product-card";
import { breadcrumbJsonLd } from "@/lib/seo";
import { currentSiteUrl } from "@/lib/site-origin";
import { formatMinor } from "@/lib/format";

type Params = Promise<{ category: string; slug: string }>;

export const revalidate = 300; // ISR per PRD §4.4 — content parity with the journal index

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, slug } = await params;
  const post = await getJournalPost(slug).catch((error: unknown) => {
    console.error("[journal] post load failed", error);
    return null;
  });
  // The URL is only self-consistent when the article's own category matches
  // the segment (FR-201-style honesty) — a mismatch is a 404, so metadata
  // collapses to the not-found title too.
  if (!post || post.category !== category) return { title: "Journal — not found" };
  const title = post.title;
  const description = post.excerpt ?? `Stories from the workshop — ${post.category}.`;
  // Canonical + og:url follow the R5-2 sitewide convention; the path is the
  // category-scoped reader route itself.
  return {
    title,
    description,
    alternates: { canonical: `/journal/${post.category}/${post.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/journal/${post.category}/${post.slug}`,
      siteName: "Scandi Haven",
    },
  };
}

/**
 * Journal reader (PRD FR-703; live E2E audit round 7, R7-2): sanitized rich
 * body, Article JSON-LD (§11.1), and related-product embeds priced from the
 * live default variant (the same `listProducts` CTE the shop grid uses — no
 * second price path). Embeds hide when `related_product_ids` is empty
 * (FR-701 hide-when-missing convention).
 */
export default async function JournalArticlePage({ params }: { params: Params }) {
  const { category, slug } = await params;
  const [post, siteUrl] = await Promise.all([
    getJournalPost(slug).catch((error: unknown) => {
      console.error("[journal] post load failed", error);
      return null;
    }),
    currentSiteUrl(),
  ]);
  if (!post || post.category !== category) notFound();

  const canonicalUrl = `${siteUrl}/journal/${post.category}/${post.slug}`;

  // Related products with live prices (FR-703 inline embeds). The ids path
  // of listProducts fetches the full member set — bounded by the 500-id schema cap.
  const related =
    post.relatedProductIds.length > 0
      ? await listProducts({ ids: post.relatedProductIds, region: "EU" }).catch((error: unknown) => {
          console.error("[journal] related products load failed", error);
          return { items: [], total: 0, page: 1, pageCount: 0 };
        })
      : { items: [], total: 0, page: 1, pageCount: 0 };

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "Scandi Haven" },
    mainEntityOfPage: canonicalUrl,
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    dateModified: post.publishedAt?.toISOString(),
  };
  const crumbs = breadcrumbJsonLd(siteUrl, [
    { name: "Home", path: "/" },
    { name: "Journal", path: "/journal" },
    { name: post.title, path: `/journal/${post.category}/${post.slug}` },
  ]);

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <script
        type="application/ld+json"
        // Server-generated structured data (§11.1, FR-703); escaped so a title
        // containing `</script>` cannot break out (audit 2026-09-09 H-2).
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/journal" className="hover:text-accent-2">
          Journal
        </Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <span className="capitalize">{post.category}</span>
      </nav>

      <p className="mt-6 text-xs uppercase tracking-wide text-muted">
        {post.category} · {post.author}
        {post.publishedAt ? ` · ${post.publishedAt.toISOString().slice(0, 10)}` : ""}
      </p>
      <h1 className="mt-2 font-display text-4xl">{post.title}</h1>
      {post.excerpt ? <p className="mt-4 text-lg leading-relaxed text-ink-2">{post.excerpt}</p> : null}

      <div
        className="mt-10 space-y-4 leading-relaxed text-ink-2"
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(post.bodyHtml) }}
      />

      {related.items.length > 0 ? (
        <section aria-labelledby="journal-related" className="mt-16 border-t border-line pt-8">
          <h2 id="journal-related" className="font-display text-2xl">
            Pieces in this story
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {related.items.map((item) => (
              <ProductCard
                key={item.slug}
                product={item}
                formattedPrice={formatMinor(item.priceMinor, item.currency)}
                formattedCompareAt={item.compareAtMinor ? formatMinor(item.compareAtMinor, item.currency) : null}
              />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
