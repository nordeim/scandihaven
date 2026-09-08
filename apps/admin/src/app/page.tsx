import { desc, eq, sql } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { order, product, user } from "@scandihaven/db/schema";
import { formatMinor } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Dashboard (PRD FR-801): revenue, pending fulfilment, catalog counts. */
export default async function AdminDashboardPage() {
  const [revenueRow] = await db
    .select({
      revenue: sql<number>`COALESCE(SUM(${order.totalEur}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(order)
    .where(sql`${order.status} NOT IN ('cancelled', 'pending_payment')`);

  const pending = await db
    .select({ number: order.number, status: order.status, total: order.total, currency: order.currency })
    .from(order)
    .where(sql`${order.status} IN ('confirmed', 'in_production', 'partially_shipped')`)
    .orderBy(desc(order.placedAt))
    .limit(8);

  const [catalogCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(product)
    .where(eq(product.status, "active"));

  const [customerCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(user);

  const cards = [
    { label: "Revenue (all time)", value: formatMinor(Number(revenueRow?.revenue ?? 0), "EUR") },
    { label: "Paid orders", value: String(revenueRow?.count ?? 0) },
    { label: "Active products", value: String(catalogCount?.count ?? 0) },
    { label: "Customers", value: String(customerCount?.count ?? 0) },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-display text-3xl">Dashboard</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-card border border-line bg-bg p-6">
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-2 font-display text-2xl tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-12" aria-label="Orders pending fulfilment">
        <h2 className="font-display text-xl">Pending fulfilment</h2>
        {pending.length === 0 ? (
          <p className="mt-4 text-md text-muted">Nothing in the queue — good news.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-bg">
            {pending.map((o) => (
              <li key={o.number} className="flex items-center justify-between p-4">
                <span className="font-medium">{o.number}</span>
                <span className="text-sm text-muted">{o.status}</span>
                <span className="tabular-nums">{formatMinor(o.total, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
