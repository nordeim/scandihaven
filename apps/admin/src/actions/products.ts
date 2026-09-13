"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@scandihaven/db/client";
import {
  inventoryLevel,
  inventoryMovement,
  product,
  productVariant,
  variantPrice,
} from "@scandihaven/db/schema";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import {
  ProductActionError,
  requirePermission,
  toActionError,
  writeAudit,
} from "@/lib/admin-guard";

const productUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(2).max(200),
  status: z.enum(["draft", "active", "archived"]),
  priceMinor: z.number().int().min(0),
  stockDelta: z.number().int().min(-10_000).max(10_000).default(0),
  seoTitle: z.string().max(180).optional(),
  seoDescription: z.string().max(320).optional(),
});

/** Product edit action (PRD FR-802/FR-803) — RBAC-gated, audit-logged. */
export async function updateProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  // A-1 (round 11): requirePermission OUTSIDE the try — it re-auths by
  // THROWING a NEXT_REDIRECT, which the catch below would otherwise log as
  // an error and swallow into a dead-end INTERNAL fail (expired sessions
  // could never re-auth from the mutation surface).
  const guard = await requirePermission("catalog:edit");

  try {
    const parsed = productUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid product data");
    }
    const data = parsed.data;

    // A-2/A-3 (round 11): the whole update is ONE transaction, and the
    // inventory adjustment locks its row (FOR UPDATE) before computing —
    // previously four sequential writes could land half-applied on a
    // mid-failure (prices updated, inventory not, no audit row for the
    // partial change), and the read-modify-write of qtyOnHand lost
    // concurrent updates (webhook movement racing an admin edit) leaving
    // the ledger disagreeing with inventory_level.
    const appliedStockDelta = await db.transaction(async (tx) => {
      const before = await tx.select().from(product).where(eq(product.id, data.id)).limit(1);
      if (!before[0]) throw new ProductActionError("NOT_FOUND", "Product not found");

      await tx
        .update(product)
        .set({
          title: data.title,
          status: data.status,
          seoTitle: data.seoTitle ?? before[0].seoTitle,
          seoDescription: data.seoDescription ?? before[0].seoDescription,
          updatedAt: new Date(),
        })
        .where(eq(product.id, data.id));

      // Price lives on the variant rows (EUR) — update every variant of the product.
      const variants = await tx
        .select({ id: productVariant.id })
        .from(productVariant)
        .where(eq(productVariant.productId, data.id));
      for (const variant of variants) {
        await tx
          .update(variantPrice)
          .set({ amount: data.priceMinor })
          .where(eq(variantPrice.variantId, variant.id));
      }

      let appliedDelta = 0;
      if (data.stockDelta !== 0) {
        const firstVariant = variants[0];
        if (firstVariant) {
          // FOR UPDATE serializes concurrent adjustments against this row
          // (A-3): the read-compute-write below can no longer lose an
          // update racing a webhook-driven movement.
          const levels = await tx
            .select()
            .from(inventoryLevel)
            .where(eq(inventoryLevel.variantId, firstVariant.id))
            .limit(1)
            .for("update");
          const level = levels[0];
          if (level) {
            const nextOnHand = Math.max(0, level.qtyOnHand + data.stockDelta);
            appliedDelta = nextOnHand - level.qtyOnHand;
            await tx
              .update(inventoryLevel)
              .set({ qtyOnHand: nextOnHand, updatedAt: new Date() })
              .where(eq(inventoryLevel.variantId, level.variantId));
            // Adjustments are ledger-recorded, never silent (FR-803): every
            // on-hand change leaves an append-only inventory_movement row.
            await tx.insert(inventoryMovement).values({
              variantId: level.variantId,
              warehouseId: level.warehouseId,
              delta: appliedDelta,
              reason: "adjustment",
              referenceType: "admin",
              referenceId: data.id,
            });
          }
        }
      }

      // Audit INSIDE the transaction (A-2): a rolled-back update leaves
      // neither the change nor a phantom audit row.
      await writeAudit(
        {
          actorId: guard.userId,
          actorRole: guard.role,
          action: "product.update",
          entityType: "product",
          entityId: data.id,
          before: { title: before[0].title, status: before[0].status },
          after: {
            title: data.title,
            status: data.status,
            priceMinor: data.priceMinor,
            appliedStockDelta,
          },
        },
        tx,
      );
      return appliedDelta;
    });

    revalidatePath("/products");
    revalidatePath("/", "layout");
    return ok({ id: data.id, appliedStockDelta }, ["product", "layout"]);
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) return fail(mapped.code, mapped.message);
    console.error("[admin product] update failed", error);
    return fail("INTERNAL", "Product update failed. Please try again.");
  }
}
