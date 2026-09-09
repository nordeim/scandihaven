import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@scandihaven/auth/server";
import { db } from "@scandihaven/db/client";
import { order } from "@scandihaven/db/schema";
import { formatMinor } from "@/lib/format";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Account dashboard (PRD FR-602..604, Phase 0 scope: session + orders). */
export default async function AccountPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch((error: unknown) => { console.error("[account] session check failed", error); return null; });

  if (!session?.user) {
    // FR-602: carry the destination through sign-in so the customer returns
    // here after authenticating (live E2E audit 2026-09-10, E2E-5 — the
    // param used to be dropped and sign-in always landed on /account).
    redirect(`/sign-in?redirect=${encodeURIComponent("/account")}`);
  }

  const orders = await db
    .select({
      number: order.number,
      status: order.status,
      total: order.total,
      currency: order.currency,
      placedAt: order.placedAt,
    })
    .from(order)
    .where(eq(order.userId, session.user.id))
    .orderBy(desc(order.placedAt))
    .limit(20);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <h1 className="font-display text-4xl">Welcome back, {session.user.name || "friend"}</h1>
      <p className="mt-2 text-md text-muted">{session.user.email}</p>

      <section className="mt-12" aria-label="Order history">
        <h2 className="font-display text-2xl">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-md text-muted">
            No orders yet. When you place one it will appear here with tracking.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-card border border-line">
            {orders.map((o) => (
              <li key={o.number} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium">{o.number}</p>
                  <p className="text-sm text-muted">
                    {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : "—"} · {o.status}
                  </p>
                </div>
                <span className="tabular-nums">{formatMinor(o.total, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
