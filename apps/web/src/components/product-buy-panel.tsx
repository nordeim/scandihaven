"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadTimeBadge } from "@scandihaven/ui/lead-time-badge";
import { Button } from "@scandihaven/ui/button";
import { QuantityStepper } from "@scandihaven/ui/quantity-stepper";
import type { VariantDto } from "@scandihaven/commerce/dto";
import { addToCartAction } from "@/actions/cart";
import { useCartStore } from "@/stores/cart-store";
import { formatMinor } from "@/lib/format";

export type BuyPanelProduct = {
  id: string;
  title: string;
  materials: string[];
  leadTimeDaysMin: number;
  leadTimeDaysMax: number;
};

/**
 * PDP buy panel (PRD FR-302..305): variant swatches with per-variant stock
 * state, quantity, add-to-cart (opens drawer), wishlist (store only in scaffold).
 */
export function ProductBuyPanel({
  product,
  variants,
  currency,
}: {
  product: BuyPanelProduct;
  variants: VariantDto[];
  currency: string;
}) {
  const router = useRouter();
  // Deep-link support (FR-302): honor ?variant=SKU on load, shareable via URL.
  const [selectedSku, setSelectedSku] = useState<string>(() => {
    const fromUrl =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("variant") : null;
    return (
      variants.find((v) => v.sku === fromUrl)?.sku ??
      variants.find((v) => v.isDefault)?.sku ??
      variants[0]?.sku ??
      ""
    );
  });
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openDrawer = useCartStore((s) => s.open);

  const selected = useMemo(
    () => variants.find((v) => v.sku === selectedSku) ?? variants[0],
    [variants, selectedSku],
  );

  if (!selected) return null;

  /** FR-302: selection is reflected in the URL (?variant=SKU) via replaceState. */
  const onSelectVariant = (sku: string) => {
    setSelectedSku(sku);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", sku);
    window.history.replaceState(null, "", url);
  };

  const onAdd = () => {
    setError(null);
    startTransition(async () => {
      // Per-add idempotency key (PRD §8.3): retries within 5 min are no-ops.
      const result = await addToCartAction({
        variantId: selected.id,
        qty,
        requestId: crypto.randomUUID(),
      });
      if (result.ok) {
        openDrawer();
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-2">
          {product.materials.join(" · ")}
        </p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">{product.title}</h1>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xl font-medium tabular-nums">
          {formatMinor(selected.priceMinor, currency)}
        </span>
        {selected.compareAtMinor ? (
          <span className="text-md text-muted line-through tabular-nums">
            {formatMinor(selected.compareAtMinor, currency)}
          </span>
        ) : null}
        <LeadTimeBadge
          availability={selected.availability}
          leadTimeDaysMin={product.leadTimeDaysMin}
          leadTimeDaysMax={product.leadTimeDaysMax}
          className="mt-2 self-start"
        />
      </div>

      {/* Variant selection (FR-302) */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-2">
          {selected.color ?? "Variant"}
        </legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => {
            const isAvailable = variant.availability !== "out_of_stock";
            const isSelected = variant.sku === selected.sku;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => onSelectVariant(variant.sku)}
                disabled={!isAvailable}
                aria-pressed={isSelected}
                title={
                  isAvailable
                    ? (variant.color ?? variant.sku)
                    : `${variant.color ?? variant.sku} — out of stock`
                }
                className={`inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm transition-colors ${
                  isSelected
                    ? "border-accent-2 bg-bg-3 text-ink"
                    : "border-line text-ink-2 hover:border-accent hover:text-ink"
                } ${!isAvailable ? "cursor-not-allowed opacity-40 line-through" : ""}`}
              >
                {variant.colorHex ? (
                  <span
                    aria-hidden
                    className="inline-block size-3.5 rounded-pill border border-line"
                    style={{ backgroundColor: variant.colorHex }}
                  />
                ) : null}
                {variant.color ?? variant.sku}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={qty} onChange={setQty} disabled={isPending} />
        <Button size="lg" onClick={onAdd} disabled={isPending || selected.availability === "out_of_stock"}>
          {isPending ? "Adding…" : "Add to cart"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-sm leading-relaxed text-muted">
        Made slowly in our Aalborg workshop. 10-year guarantee, carbon-neutral delivery,
        14-day returns on in-stock pieces.
      </p>
    </div>
  );
}
