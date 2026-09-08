"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@scandihaven/db/client";
import { order, orderEvent } from "@scandihaven/db/schema";
import { transition, InvalidOrderTransition, type OrderEvent } from "@scandihaven/commerce/order-state";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import { requirePermission, writeAudit } from "@/lib/admin-guard";

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  event: z.enum([
    "flag_for_review",
    "release_to_production",
    "start_production",
    "mark_partially_shipped",
    "mark_shipped",
    "mark_delivered",
    "close",
    "cancel",
  ]),
  from: z.enum([
    "pending_payment",
    "review",
    "confirmed",
    "in_production",
    "partially_shipped",
    "shipped",
    "delivered",
    "closed",
    "cancelled",
    "refunded",
    "partially_refunded",
  ]),
});

/** Order lifecycle action (PRD FR-807): state machine + audit + revalidation. */
export async function transitionOrderAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Invalid transition input");
  const { orderId, event, from } = parsed.data;

  const permission = event === "cancel" ? "orders:cancel" : "orders:fulfill";
  const guard = await requirePermission(permission);

  try {
    const next = transition(from, event as OrderEvent);
    await db.transaction(async (tx) => {
      await tx.update(order).set({ status: next, updatedAt: new Date() }).where(eq(order.id, orderId));
      await tx.insert(orderEvent).values({
        orderId,
        type: event,
        actor: guard.userId,
        payload: { from, to: next },
      });
    });

    await writeAudit({
      actorId: guard.userId,
      actorRole: guard.role,
      action: `order.${event}`,
      entityType: "order",
      entityId: orderId,
      after: { status: next },
    });

    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
    return ok({ status: next });
  } catch (error) {
    if (error instanceof InvalidOrderTransition) {
      return fail("INVALID_TRANSITION", error.message);
    }
    console.error("[admin order] transition failed", error);
    return fail("INTERNAL", "Order update failed. Please try again.");
  }
}
