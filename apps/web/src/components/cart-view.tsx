"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@scandihaven/ui/button";
import { Input } from "@scandihaven/ui/input";
import { MediaImage } from "@scandihaven/ui/media-image";
import { QuantityStepper } from "@scandihaven/ui/quantity-stepper";
import type { CartDto } from "@scandihaven/commerce/dto";
import { applyPromotionAction, removeLineAction, updateQtyAction } from "@/actions/cart";
import { formatMinor } from "@/lib/format";

/** Full cart page (PRD FR-402): lines, promo code, totals, checkout CTA. */
export function CartView({ initialCart }: { initialCart: CartDto | null }) {
  const [cart, setCart] = useState(initialCart);
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = (update: Promise<{ ok: boolean } & Record<string, unknown>>) => {
    startTransition(async () => {
      const result = (await update) as
        | { ok: true; data: CartDto }
        | { ok: false; error: { message: string } };
      if (result.ok) {
        setCart(result.data);
        setActionError(null);
      } else {
        // Failure surfacing + re-sync (audit 2026-09-09 H-4): the optimistic
        // write is rolled back to the last server truth and the customer
        // sees why — the stock/line state changed under them.
        setActionError(result.error.message);
        setCart(initialCart);
      }
    });
  };

  const onQty = (lineId: string, qty: number) => {
    if (!cart) return;
    // Optimistic update; rolled back by the server response.
    setCart({
      ...cart,
      lines: cart.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)),
    });
    refresh(updateQtyAction({ lineId, qty }));
  };

  const onRemove = (lineId: string) => {
    refresh(removeLineAction({ lineId }));
  };

  const onPromo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPromoMessage(null);
    startTransition(async () => {
      const result = await applyPromotionAction({ code: promoCode });
      if (result.ok) {
        setCart(result.data);
        setPromoMessage(`Code ${result.data.appliedPromotionCode} applied.`);
      } else {
        setPromoMessage(result.error.message);
      }
    });
  };

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center md:px-8">
        <h1 className="font-display text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-md text-muted">Pieces you add will appear here.</p>
        <Link href="/shop" className="mt-8 inline-block">
          <Button size="lg">Browse the shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-12 px-5 py-12 md:px-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="font-display text-4xl">Cart</h1>
        {actionError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}
        <ul className="mt-8 divide-y divide-line" aria-busy={isPending}>
          {cart.lines.map((line) => (
            <li key={line.id} className="flex gap-5 py-6">
              <MediaImage
                src={line.imageUrl}
                alt={line.imageAlt}
                width={160}
                height={200}
                className="w-24 shrink-0 md:w-32"
              />
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/products/${line.productSlug}`}
                      className="font-display text-lg hover:text-accent-2"
                    >
                      {line.productTitle}
                    </Link>
                    <p className="text-sm text-muted">{line.variantLabel}</p>
                  </div>
                  <span className="text-md tabular-nums">
                    {formatMinor(line.totalMinor, cart.currency)}
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <QuantityStepper
                    value={line.qty}
                    onChange={(next) => onQty(line.id, next)}
                    disabled={isPending}
                    label={`Quantity for ${line.productTitle}`}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(line.id)}
                    disabled={isPending}
                    className="text-sm text-muted underline-offset-2 hover:text-accent-2 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-card border border-line bg-bg-2 p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-xl">Order summary</h2>
        <dl className="mt-4 space-y-2 text-md">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatMinor(cart.subtotalMinor, cart.currency)}</dd>
          </div>
          {cart.discountMinor > 0 ? (
            <div className="flex justify-between text-sage">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{formatMinor(cart.discountMinor, cart.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd className="text-sm text-muted">Calculated at checkout</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMinor(cart.totalMinor, cart.currency)}</dd>
          </div>
        </dl>

        <form onSubmit={onPromo} className="mt-5 flex gap-2">
          <label htmlFor="promo" className="sr-only">
            Promotion code
          </label>
          <Input
            id="promo"
            placeholder="Promotion code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            autoComplete="off"
          />
          <Button type="submit" variant="outline" disabled={isPending}>
            Apply
          </Button>
        </form>
        {promoMessage ? (
          <p role="status" className="mt-2 text-sm text-ink-2">
            {promoMessage}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">Try WELCOME100 on orders over €500.</p>

        <Link href="/checkout" className="mt-6 block">
          <Button size="lg" className="w-full">
            Proceed to checkout
          </Button>
        </Link>
      </aside>
    </div>
  );
}
