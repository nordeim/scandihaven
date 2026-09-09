import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { inventoryLevel, product, productVariant, variantPrice } from "@scandihaven/db/schema";
import { ProductEditForm } from "./edit-form";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

/** Product edit (PRD FR-802/FR-803 — Phase 0 scope: title, status, price, stock). */
export default async function AdminProductEditPage({ params }: { params: Params }) {
  const { id } = await params;

  const rows = await db.select().from(product).where(eq(product.id, id)).limit(1);
  const productRow = rows[0];
  if (!productRow) notFound();

  const variantRows = await db
    .select({
      id: productVariant.id,
      sku: productVariant.sku,
      color: productVariant.color,
      amount: variantPrice.amount,
      qtyOnHand: inventoryLevel.qtyOnHand,
      warehouse: inventoryLevel.warehouseId,
    })
    .from(productVariant)
    .leftJoin(variantPrice, and(eq(variantPrice.variantId, productVariant.id), eq(variantPrice.currency, "EUR")))
    .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, productVariant.id))
    .where(eq(productVariant.productId, id))
    .orderBy(asc(productVariant.sku));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl">{productRow.title}</h1>
      <p className="mt-1 text-sm text-muted">
        /{productRow.slug} · {productRow.status}
      </p>
      <ProductEditForm
        product={{
          id: productRow.id,
          title: productRow.title,
          status: productRow.status,
          seoTitle: productRow.seoTitle ?? "",
          seoDescription: productRow.seoDescription ?? "",
        }}
        variants={variantRows.map((v) => ({
          sku: v.sku,
          color: v.color,
          priceMinor: v.amount ?? 0,
          qtyOnHand: v.qtyOnHand ?? 0,
        }))}
      />
    </div>
  );
}
