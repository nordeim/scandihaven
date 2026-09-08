import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { order } from "@scandihaven/db/schema";
import { formatMinor } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Order list (PRD FR-806). */
export default async function AdminOrdersPage() {
  const orders = await db
    .select({
      id: order.id,
      number: order.number,
      email: order.email,
      status: order.status,
      total: order.total,
      currency: order.currency,
      placedAt: order.placedAt,
    })
    .from(order)
    .orderBy(desc(order.placedAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-display text-3xl">Orders</h1>
      {orders.length === 0 ? (
        <p className="mt-6 text-md text-muted">No orders yet.</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-card border border-line bg-bg">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-bg-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="p-4">Number</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Status</th>
                <th className="p-4">Total</th>
                <th className="p-4">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="p-4">
                    <Link href={`/orders/${o.id}`} className="font-medium hover:text-accent-2">
                      {o.number}
                    </Link>
                  </td>
                  <td className="p-4 text-muted">{o.email}</td>
                  <td className="p-4">{o.status}</td>
                  <td className="p-4 tabular-nums">{formatMinor(o.total, o.currency)}</td>
                  <td className="p-4 text-muted">
                    {o.placedAt ? new Date(o.placedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
