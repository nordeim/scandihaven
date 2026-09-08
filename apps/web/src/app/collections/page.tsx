import type { Metadata } from "next";
import Link from "next/link";
import { listCollections } from "@scandihaven/commerce/catalog";

export const metadata: Metadata = {
  title: "Collections",
  description: "Curated collections of handcrafted Scandinavian pieces.",
};

export const revalidate = 300;

export default async function CollectionsPage() {
  const collections = await listCollections().catch(() => []);
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <h1 className="font-display text-4xl">Collections</h1>
      {collections.length === 0 ? (
        <p className="mt-8 text-md text-muted">Collections are being curated.</p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {collections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="group rounded-card border border-line p-10 transition-colors hover:border-accent"
            >
              <h2 className="font-display text-2xl group-hover:text-accent-2">
                {collection.title}
              </h2>
              {collection.subtitle ? (
                <p className="mt-2 text-md text-muted">{collection.subtitle}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
