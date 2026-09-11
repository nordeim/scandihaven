"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import { consumeRateLimit } from "@scandihaven/commerce/rate-limit";
import { requestBackInStock } from "@scandihaven/commerce/back-in-stock";
import { db } from "@scandihaven/db/client";

const inputSchema = z.object({
  variantId: z.string().uuid(),
  email: z.string().email(),
});

/**
 * Back-in-stock "Notify me" (PRD FR-310; live audit round 8, R8-6).
 * Rate-limited 3/hour/IP (newsletter idiom, §9.4); dedupe lives in the
 * service via the (variant_id, email) unique index. Successful requests feed
 * the FR-914 batched notifications once R-SHOP-3 wires inventory triggers.
 */
export async function notifyBackInStockAction(input: {
  variantId: string;
  email: string;
}): Promise<ActionResult<{ status: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", "Enter a valid email address");
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";
  const limit = await consumeRateLimit(db, {
    scope: "back_in_stock",
    identifier: ip,
    limit: 3,
    windowMs: 3_600_000,
  }).catch((error: unknown) => {
    console.error("[back-in-stock] rate limit check failed", error);
    return null;
  });
  if (limit && !limit.allowed) {
    return fail("RATE_LIMITED", "Too many requests from this network. Please try again later.");
  }

  try {
    const outcome = await requestBackInStock(parsed.data.variantId, parsed.data.email);
    return ok({ status: outcome.status });
  } catch (error) {
    if (error instanceof Error && error.message === "Variant not found") {
      return fail("VALIDATION", "This piece is no longer available for notifications.");
    }
    console.error("[back-in-stock] request failed", error);
    return fail("INTERNAL", "Could not save your request right now. Please try again.");
  }
}
