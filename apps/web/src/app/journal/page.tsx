import type { Metadata } from "next";
import { listLatestJournal } from "@scandihaven/commerce/catalog";

export const metadata: Metadata = {
  title: "Journal",
  description: "Stories from the workshop — craft, home, people, sustainability.",
};

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
              <h2 className="mt-2 font-display text-2xl">{post.title}</h2>
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
