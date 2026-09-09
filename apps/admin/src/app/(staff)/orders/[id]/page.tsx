import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { order, orderAddress, orderEvent, orderLine } from "@scandihaven/db/schema";
import { OrderActions } from "./actions-form";
import { formatMinor } from "@/lib/format";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

/** Order detail (PRD FR-806/FR-807): lines, timeline, legal-transition actions. */
export default async function AdminOrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const rows = await db.select().from(order).where(eq(order.id, id)).limit(1);
  const o = rows[0];
  if (!o) notFound();

  const lines = await db
    .select({
      id: orderLine.id,
      title: orderLine.titleSnapshot,
      sku: orderLine.skuSnapshot,
      qty: orderLine.qty,
      total: orderLine.total,
    })
    .from(orderLine)
    .where(eq(orderLine.orderId, id));

  const events = await db
    .select({ type: orderEvent.type, actor: orderEvent.actor, createdAt: orderEvent.createdAt })
    .from(orderEvent)
    .where(eq(orderEvent.orderId, id))
    .orderBy(asc(orderEvent.createdAt));

  const addresses = await db
    .select({ kind: orderAddress.kind, fields: orderAddress.fields })
    .from(orderAddress)
    .where(eq(orderAddress.orderId, id));

  const shipping = addresses.find((a) => a.kind === "shipping");
  const fields = (shipping?.fields ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl">{o.number}</h1>
        <span className="rounded-pill bg-bg-3 px-3 py-1 text-sm">{o.status}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {o.email} · placed {o.placedAt ? new Date(o.placedAt).toLocaleString() : "—"} ·{" "}
        {formatMinor(o.total, o.currency)}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-label="Line items" className="rounded-card border border-line bg-bg p-6">
          <h2 className="font-display text-xl">Lines</h2>
          <ul className="mt-4 divide-y divide-line text-sm">
            {lines.map((line) => (
              <li key={line.id} className="flex justify-between py-2">
                <span>
                  {line.title} <span className="text-muted">× {line.qty}</span>
                  <span className="ml-2 text-xs text-muted">{line.sku}</span>
                </span>
                <span className="tabular-nums">{formatMinor(line.total, o.currency)}</span>
              </li>
            ))}
          </ul>
          {shipping ? (
            <div className="mt-4 border-t border-line pt-4 text-sm text-muted">
              <p className="font-medium text-ink">Ship to</p>
              <p>
                {fields["name"] ?? ""}
                <br />
                {fields["line1"] ?? ""}
                <br />
                {fields["postalCode"] ?? ""} {fields["city"] ?? ""}
                <br />
                {fields["country"] ?? ""}
              </p>
            </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-8">
          <OrderActions orderId={o.id} status={o.status} />
          <section aria-label="Timeline" className="rounded-card border border-line bg-bg p-6">
            <h2 className="font-display text-xl">Timeline</h2>
            <ol className="mt-4 space-y-2 text-sm text-muted">
              {events.map((event, index) => (
                <li key={index}>
                  <span className="font-medium text-ink">{event.type}</span> · {event.actor} ·{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
              {events.length === 0 ? <li>No events recorded.</li> : null}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
