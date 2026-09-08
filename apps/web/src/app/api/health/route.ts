import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@scandihaven/db/client";

export const dynamic = "force-dynamic";

/** Health probe (PRD §8.4): 200 when the DB round-trips, 503 otherwise. */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", db: true, version: "0.1.0" });
  } catch (error) {
    console.error("[health] db check failed", error);
    return NextResponse.json({ status: "degraded", db: false }, { status: 503 });
  }
}
