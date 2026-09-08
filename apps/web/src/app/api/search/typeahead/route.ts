import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { searchTypeahead } from "@scandihaven/commerce/catalog";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

/** Search typeahead (PRD FR-104/FR-106, §8.4). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    q: params.get("q") ?? "",
    limit: params.get("limit") ?? 6,
  });
  if (!parsed.success) {
    return NextResponse.json({ products: [], categories: [], journal: [] });
  }
  const products = await searchTypeahead(parsed.data.q, parsed.data.limit).catch(() => []);
  return NextResponse.json({ products, categories: [], journal: [] });
}
