import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@scandihaven/db/client";
import { staticPage } from "@scandihaven/db/schema";
import { sanitizeRichText } from "@scandihaven/commerce/rich-text";
import { publicPageMetadata } from "@/lib/seo";
import { eq, and } from "drizzle-orm";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // Canonical + per-page og:url (round 5, R5-2, FR-313).
  return publicPageMetadata({
    path: `/${slug}`,
    title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
  });
}

/** Static content pages (PRD FR-704): admin-managed, render-time sanitized rich text (§9.4). */
export default async function StaticContentPage({ params }: { params: Params }) {
  const { slug } = await params;
  const rows = await db
    .select({ title: staticPage.title, bodyHtml: staticPage.bodyHtml })
    .from(staticPage)
    .where(and(eq(staticPage.slug, slug), eq(staticPage.isPublished, true)))
    .limit(1);

  const page = rows[0];
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <h1 className="font-display text-4xl">{page.title}</h1>
      <div
        className="mt-8 space-y-4 leading-relaxed text-ink-2"
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(page.bodyHtml) }}
      />
    </article>
  );
}
