import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@scandihaven/db/client";
import { searchTypeahead, searchTypeaheadCategories } from "@scandihaven/commerce/catalog";
import { consumeRateLimit } from "@scandihaven/commerce/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

// §8.4: route-handler responses are Zod-validated contracts. Products come
// from `searchTypeahead` (FTS + ILIKE over active product titles); categories
// from `searchTypeaheadCategories` (R6-2, FR-104: typeahead spans
// products/categories). Journal stays reserved for the FR-703 reader route —
// advertising journal hits would link to 404s (FR-109 honesty).
const hitSchema = z.object({ slug: z.string(), title: z.string() });
const responseSchema = z.object({
  products: z.array(hitSchema),
  categories: z.array(hitSchema),
  journal: z.array(hitSchema),
});

/** Search typeahead (PRD FR-104/FR-106, §8.4) — 60/min/IP (§9.4). */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const limit = await consumeRateLimit(db, {
    scope: "typeahead",
    identifier: ip,
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many searches. Slow down and retry." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    q: params.get("q") ?? "",
    limit: params.get("limit") ?? 6,
  });
  if (!parsed.success) {
    return NextResponse.json({ products: [], categories: [], journal: [] });
  }
  const [products, categories] = await Promise.all([
    searchTypeahead(parsed.data.q, parsed.data.limit).catch((error: unknown) => {
      console.error("[typeahead] product search failed", error);
      return [] as never;
    }),
    searchTypeaheadCategories(parsed.data.q, 4).catch((error: unknown) => {
      console.error("[typeahead] category search failed", error);
      return [] as never;
    }),
  ]);
  const body = responseSchema.parse({ products, categories, journal: [] });
  return NextResponse.json(body);
}
