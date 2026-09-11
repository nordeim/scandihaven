import { eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { backInStockRequest, productVariant } from "@scandihaven/db/schema";

/**
 * Back-in-stock request seam (PRD FR-310; live E2E audit round 8, R8-6).
 * The table and its (variant_id, email) dedupe unique index existed from the
 * schema work, but nothing wrote to it. Requests feed the FR-914 batched
 * notification flow once inventory movement crosses the safety threshold
 * (R-SHOP-3 covers the batching; this slice owns the capture).
 */
export type BackInStockOutcome = { status: "registered" | "already_registered" };

export async function requestBackInStock(
  variantId: string,
  email: string,
): Promise<BackInStockOutcome> {
  // FK target must exist: a crafted variantId would otherwise surface as a
  // raw DB error — a typed failure keeps the action mapping clean.
  const variantRows = await db
    .select({ id: productVariant.id })
    .from(productVariant)
    .where(eq(productVariant.id, variantId))
    .limit(1);
  if (!variantRows[0]) {
    throw new Error("Variant not found");
  }

  const inserted = await db
    .insert(backInStockRequest)
    .values({ variantId, email })
    // FR-310: "dedupe per email+variant" — the unique index
    // back_in_stock_variant_email_idx makes the repeat insert a no-op.
    .onConflictDoNothing()
    .returning({ id: backInStockRequest.id });

  return { status: inserted[0] ? "registered" : "already_registered" };
}
