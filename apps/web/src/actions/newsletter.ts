"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@scandihaven/db/client";
import { newsletterSubscriber } from "@scandihaven/db/schema";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import { consumeRateLimit } from "@scandihaven/commerce/rate-limit";

const inputSchema = z.object({
  email: z.string().email(),
  source: z.string().max(40).default("footer"),
});

/**
 * Newsletter signup (PRD FR-107). Rate-limited 3/hour/IP (§9.4) via the
 * Postgres window limiter; double opt-in confirmation lands with the Phase 1
 * account work (PRD §13.6).
 */
export async function subscribeAction(input: {
  email: string;
}): Promise<ActionResult<{ status: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Enter a valid email address");

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";
  const limit = await consumeRateLimit(db, {
    scope: "newsletter",
    identifier: ip,
    limit: 3,
    windowMs: 3_600_000,
  }).catch((error: unknown) => {
    console.error("[newsletter] rate limit check failed", error);
    return null;
  });
  if (limit && !limit.allowed) {
    return fail("RATE_LIMITED", "Too many signups from this network. Please try again later.");
  }

  try {
    const inserted = await db
      .insert(newsletterSubscriber)
      .values({ email: parsed.data.email, source: parsed.data.source })
      .onConflictDoNothing()
      .returning({ id: newsletterSubscriber.id });

    return ok({
      status: inserted[0] ? "subscribed" : "already-subscribed",
    });
  } catch (error) {
    console.error("[newsletter] subscribe failed", error);
    return fail("INTERNAL", "Could not subscribe right now. Please try again.");
  }
}
