import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { product, productVariant, variantPrice } from "@scandihaven/db/schema";
import { formatMinor } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Product list (PRD FR-802). */
export default async function AdminProductsPage() {
  const rows = await db
    .select({
      id: product.id,
      slug: product.slug,
      title: product.title,
      status: product.status,
      priceMinor: variantPrice.amount,
      updatedAt: product.updatedAt,
    })
    .from(product)
    .innerJoin(productVariant, eq(productVariant.productId, product.id))
    .innerJoin(
      variantPrice,
      and(eq(variantPrice.variantId, productVariant.id), eq(variantPrice.currency, "EUR")),
    )
    .orderBy(desc(product.updatedAt))
    .limit(100);

  const seen = new Set<string>();

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-display text-3xl">Products</h1>
      <div className="mt-8 overflow-hidden rounded-card border border-line bg-bg">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-bg-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Status</th>
              <th className="p-4">Price (EUR)</th>
              <th className="p-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (seen.has(row.id)) return null;
              seen.add(row.id);
              return (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="p-4">
                    <Link href={`/products/${row.id}`} className="font-medium hover:text-accent-2">
                      {row.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted">/{row.slug}</span>
                  </td>
                  <td className="p-4">{row.status}</td>
                  <td className="p-4 tabular-nums">{formatMinor(row.priceMinor ?? 0, "EUR")}</td>
                  <td className="p-4 text-muted">{new Date(row.updatedAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
