"use client";

import { useState, useTransition } from "react";
import { Button } from "@scandihaven/ui/button";
import { addToCartAction } from "@/actions/cart";
import { useCartStore } from "@/stores/cart-store";

/**
 * PLP quick-add (PRD FR-206; R9-4): adds the product's first purchasable
 * variant (resolved by the cards CTE — default first, sold-out skipped) at
 * qty 1 and opens the mini-cart drawer, exactly like the PDP's add-to-cart
 * (FR-305 contract: add-to-cart opens the drawer). Rendered OUTSIDE the card
 * link semantics via the ProductCard quickAdd slot (FR-206 a11y note).
 * Disabled with "Sold out" copy when no variant is purchasable.
 */
export function QuickAddButton({
  variantId,
  productTitle,
}: {
  variantId: string | null;
  productTitle: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const openDrawer = useCartStore((s) => s.open);

  const onAdd = () => {
    if (!variantId) return;
    setError(null);
    // Client-generated idempotency key (PRD §8.3): double-taps dedupe
    // server-side within the 5-minute window — same idiom as the PDP.
    const requestId = crypto.randomUUID();
    startTransition(async () => {
      const result = await addToCartAction({ variantId, qty: 1, requestId });
      if (result.ok) {
        openDrawer();
      } else {
        setError(result.error.message);
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={onAdd}
        disabled={isPending || !variantId}
        aria-label={variantId ? `Quick add ${productTitle} to cart` : `${productTitle} is sold out`}
      >
        {isPending ? "Adding…" : variantId ? "Quick add" : "Sold out"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
