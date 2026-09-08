"use server";

import { z } from "zod";
import { db } from "@scandihaven/db/client";
import { newsletterSubscriber } from "@scandihaven/db/schema";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";

const inputSchema = z.object({
  email: z.string().email(),
  source: z.string().max(40).default("footer"),
});

/** Newsletter signup (PRD FR-107): double opt-in stub, rate-limited upstream. */
export async function subscribeAction(input: {
  email: string;
}): Promise<ActionResult<{ status: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Enter a valid email address");

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
