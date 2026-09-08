import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@scandihaven/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", db: true });
  } catch {
    return NextResponse.json({ status: "degraded", db: false }, { status: 503 });
  }
}
