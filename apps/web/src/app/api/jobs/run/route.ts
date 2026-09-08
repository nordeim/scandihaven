/**
 * Outbox drainer (PRD §8.4, ADR-8). Machine callers only — Vercel cron (or an
 * external scheduler) hits this route with the CRON_SECRET header; it is not
 * part of any UI flow (no REST mutations for first-party UI, §8.1).
 *
 * Composition root: the domain runner (PgJobRunner) meets its adapters here —
 * the EmailProvider binding wraps @scandihaven/email so the Resend SDK never
 * leaves that package (§4.8 vendor-adapter rule).
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@scandihaven/db/client";
import { PgJobRunner, type JobHandler } from "@scandihaven/commerce/jobs";
import { sendOrderConfirmation } from "@scandihaven/email/send";

function leadTimeNote(daysMax: number): string {
  if (daysMax <= 0) return "";
  if (daysMax <= 7) return "In-stock items ship within a few days.";
  const weeks = Math.ceil(daysMax / 7);
  return `Made-to-order pieces ship in about ${weeks} weeks.`;
}

const handlers: Record<string, JobHandler> = {
  "email.order_confirmation": async (payload) => {
    const p = payload as {
      to: string;
      orderNumber: string;
      customerName?: string;
      totalMinor?: number;
      currency?: string;
      leadTimeDaysMax?: number;
    };
    const totalFormatted = new Intl.NumberFormat("en", {
      style: "currency",
      currency: p.currency ?? "EUR",
    }).format((p.totalMinor ?? 0) / 100);
    await sendOrderConfirmation({
      to: p.to,
      orderNumber: p.orderNumber,
      customerName: p.customerName ?? "customer",
      totalFormatted,
      leadTimeNote: leadTimeNote(p.leadTimeDaysMax ?? 0),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    });
  },
};

const runner = new PgJobRunner({ db, handlers });

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.includes("set-me")) return false;
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

async function run(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runner.drain();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
