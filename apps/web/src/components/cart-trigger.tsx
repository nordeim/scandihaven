"use client";

import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";

/** Client island opening the mini-cart drawer (FR-401). */
export function CartTrigger({ itemCount }: { itemCount: number }) {
  const open = useCartStore((s) => s.open);
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
      className="relative rounded-pill p-2 text-ink transition-colors hover:bg-bg-2"
    >
      <ShoppingCart className="size-5" aria-hidden />
      {itemCount > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent-2 px-1 text-[11px] font-medium text-white"
        >
          {itemCount}
        </span>
      ) : null}
    </button>
  );
}
