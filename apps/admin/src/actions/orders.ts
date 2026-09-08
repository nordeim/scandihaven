"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@scandihaven/db/client";
import { order, orderEvent } from "@scandihaven/db/schema";
import { transition, type OrderEvent } from "@scandihaven/commerce/order-state";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import {
  OrderActionError,
  requirePermission,
  toActionError,
  writeAudit,
} from "@/lib/admin-guard";

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
  // The client's last-seen status — used only as an optimistic-concurrency
  // token. The transition itself is always computed from the DB row (§7.7:
  // transition() is the only status writer; §9.7: server re-derives state).
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

  try {
    const permission = event === "cancel" ? "orders:cancel" : "orders:fulfill";
    const guard = await requirePermission(permission);

    const next = await db.transaction(async (tx) => {
      // Read the authoritative status under lock — never trust the form's
      // `from` for state derivation (§9.7 STRIDE tampering).
      const rows = await tx
        .select({ status: order.status })
        .from(order)
        .where(eq(order.id, orderId))
        .limit(1)
        .for("update");
      const current = rows[0];
      if (!current) {
        throw new OrderActionError("NOT_FOUND", "Order not found");
      }
      if (current.status !== from) {
        throw new OrderActionError(
          "CONFLICT",
          `Order is ${current.status}, not ${from}. Reload the order and retry.`,
        );
      }
      const nextStatus = transition(current.status, event as OrderEvent);
      await tx
        .update(order)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(and(eq(order.id, orderId), eq(order.status, current.status)));
      await tx.insert(orderEvent).values({
        orderId,
        type: event,
        actor: guard.userId,
        payload: { from: current.status, to: nextStatus },
      });
      return nextStatus;
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
    const mapped = toActionError(error);
    if (mapped) return fail(mapped.code, mapped.message);
    console.error("[admin order] transition failed", error);
    return fail("INTERNAL", "Order update failed. Please try again.");
  }
}
