"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Drawer, DrawerContent } from "@scandihaven/ui/drawer";
import { Button } from "@scandihaven/ui/button";
import { QuantityStepper } from "@scandihaven/ui/quantity-stepper";
import { MediaImage } from "@scandihaven/ui/media-image";
import type { CartDto } from "@scandihaven/commerce/dto";
import { removeLineAction, updateQtyAction } from "@/actions/cart";
import { useCartStore } from "@/stores/cart-store";
import { formatMinor } from "@/lib/format";

/**
 * Mini-cart drawer (PRD FR-401). Receives the server-truth CartDto as props
 * from the RSC tree; optimistic qty updates roll back on action failure.
 */
export function CartDrawer({ cart }: { cart: CartDto | null }) {
  const drawerOpen = useCartStore((s) => s.drawerOpen);
  const close = useCartStore((s) => s.close);
  const [isPending, startTransition] = useTransition();

  const onQty = (lineId: string, qty: number) => {
    startTransition(async () => {
      await updateQtyAction({ lineId, qty });
    });
  };

  const onRemove = (lineId: string) => {
    startTransition(async () => {
      await removeLineAction({ lineId });
    });
  };

  return (
    <Drawer open={drawerOpen} onOpenChange={(next) => (next ? undefined : close())}>
      {drawerOpen ? (
        <DrawerContent title="Cart" className="p-6">
          <p className="font-display text-xl">Your cart</p>
          {cart === null || cart.lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="text-md text-muted">Your cart is empty.</p>
              <Link href="/shop" onClick={close}>
                <Button variant="secondary">Browse the shop</Button>
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-6 flex-1 space-y-5 overflow-y-auto" aria-busy={isPending}>
                {cart.lines.map((line) => (
                  <li key={line.id} className="flex gap-4">
                    <MediaImage
                      src={line.imageUrl}
                      alt={line.imageAlt}
                      width={120}
                      height={150}
                      className="w-20 shrink-0"
                    />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Link
                        href={`/products/${line.productSlug}`}
                        onClick={close}
                        className="font-medium hover:text-accent-2"
                      >
                        {line.productTitle}
                      </Link>
                      <p className="text-xs text-muted">{line.variantLabel}</p>
                      <div className="flex items-center justify-between gap-3">
                        <QuantityStepper
                          value={line.qty}
                          onChange={(next) => onQty(line.id, next)}
                          disabled={isPending}
                          label={`Quantity for ${line.productTitle}`}
                        />
                        <span className="text-md tabular-nums">
                          {formatMinor(line.totalMinor, cart.currency)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(line.id)}
                        disabled={isPending}
                        className="self-start text-xs text-muted underline-offset-2 hover:text-accent-2 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Subtotal</span>
                  <span className="tabular-nums">{formatMinor(cart.subtotalMinor, cart.currency)}</span>
                </div>
                {cart.discountMinor > 0 ? (
                  <div className="mt-1 flex items-center justify-between text-sm text-sage">
                    <span>Discount {cart.appliedPromotionCode ? `(${cart.appliedPromotionCode})` : ""}</span>
                    <span className="tabular-nums">−{formatMinor(cart.discountMinor, cart.currency)}</span>
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-muted">Shipping and taxes calculated at checkout.</p>
                <Link href="/cart" onClick={close} className="mt-4 block">
                  <Button className="w-full">View cart</Button>
                </Link>
                <Link href="/checkout" onClick={close} className="mt-2 block">
                  <Button variant="secondary" className="w-full">
                    Proceed to checkout
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}
