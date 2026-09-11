import type { Metadata } from "next";
import Link from "next/link";
import { listLatestJournal } from "@scandihaven/commerce/catalog";
import { publicPageMetadata } from "@/lib/seo";

// Canonical + per-page og:url (round 5, R5-2, FR-313).
export const metadata: Metadata = publicPageMetadata({
  path: "/journal",
  title: "Journal",
  description: "Stories from the workshop — craft, home, people, sustainability.",
});

export const revalidate = 300;

export default async function JournalPage() {
  const posts = await listLatestJournal(12).catch((error: unknown) => { console.error("[journal] posts load failed", error); return [] as never; });
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <h1 className="font-display text-4xl">Journal</h1>
      {posts.length === 0 ? (
        <p className="mt-8 text-md text-muted">First entries are on the workbench.</p>
      ) : (
        <div className="mt-10 space-y-10">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-line pb-10">
              <p className="text-xs uppercase tracking-wide text-muted">{post.category}</p>
              {/* FR-703: the index links into the category-scoped reader route (R7-2) */}
              <h2 className="mt-2 font-display text-2xl">
                <Link href={`/journal/${post.category}/${post.slug}`} className="hover:text-accent-2">
                  {post.title}
                </Link>
              </h2>
              {post.excerpt ? (
                <p className="mt-2 leading-relaxed text-ink-2">{post.excerpt}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
