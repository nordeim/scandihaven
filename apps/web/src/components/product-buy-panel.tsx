"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadTimeBadge } from "@scandihaven/ui/lead-time-badge";
import { Button } from "@scandihaven/ui/button";
import { Input } from "@scandihaven/ui/input";
import { QuantityStepper } from "@scandihaven/ui/quantity-stepper";
import type { VariantDto } from "@scandihaven/commerce/dto";
import { addToCartAction } from "@/actions/cart";
import { notifyBackInStockAction } from "@/actions/back-in-stock";
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
  // Deep-link support (FR-302): honor ?variant=SKU on load. The URL is read
  // through useSyncExternalStore — server snapshot is null (default variant
  // renders first), the client snapshot takes over after hydration, so the
  // deep link never causes a hydration mismatch (audit 2026-09-09 M-3: the
  // previous window-reading useState initializer disagreed with SSR).
  const urlVariant = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("popstate", onStoreChange);
      return () => window.removeEventListener("popstate", onStoreChange);
    },
    () => new URLSearchParams(window.location.search).get("variant"),
    () => null,
  );
  const [selectedSku, setSelectedSku] = useState<string>(
    () => variants.find((v) => v.isDefault)?.sku ?? variants[0]?.sku ?? "",
  );
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openDrawer = useCartStore((s) => s.open);

  const selected = useMemo(
    () =>
      variants.find((v) => v.sku === urlVariant && v.availability !== "out_of_stock") ??
      variants.find((v) => v.sku === selectedSku) ??
      variants[0],
    [variants, urlVariant, selectedSku],
  );

  // Sticky mobile add-to-cart bar (FR-309, R9-5): shown only when the primary
  // CTA row has scrolled out of the viewport. The observer callback fires
  // asynchronously — never effect-body setState (the R6-2 derived-visibility
  // discipline). Initial state `true` matches the SSR render (bar hidden),
  // so deep links that load mid-scroll correct on the first observation.
  // Declared BEFORE the !selected early return — hooks must run unconditionally
  // (rules-of-hooks); the effect no-ops when the CTA row never rendered.
  const ctaRowRef = useRef<HTMLDivElement | null>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = ctaRowRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setCtaVisible(entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!selected) return null;

  // FR-310 (R8-6): sold-out variants expose the notify capture even though
  // their swatches stay disabled (selection contract unchanged).
  const outOfStock = variants.filter((v) => v.availability === "out_of_stock");

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

      <div ref={ctaRowRef} className="flex flex-wrap items-center gap-3">
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

      {/* FR-310 (round 8, R8-6): a sold-out variant keeps its disabled swatch
          and gains an honest "Notify me" capture — the back_in_stock_request
          row feeds the FR-914 batched notifications later. */}
      {outOfStock.map((variant) => (
        <NotifyMeRow key={variant.id} variant={variant} />
      ))}

      <p className="text-sm leading-relaxed text-muted">
        Made slowly in our Aalborg workshop. 10-year guarantee, carbon-neutral delivery,
        14-day returns on in-stock pieces.
      </p>

      {/* Sticky mobile add-to-cart bar (FR-309, R9-5): price + CTA only,
          appearing after the primary CTA scrolls out of view. Hidden on ≥md
          viewports; never overlaps the footer on short pages (the observer
          only fires when the CTA actually leaves view); prefers-reduced-motion
          drops the slide-in transform. */}
      {!ctaVisible ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm motion-reduce:transform-none md:hidden"
          role="complementary"
          aria-label="Add to cart"
        >
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-5 py-3">
            <span className="text-md font-medium tabular-nums">
              {formatMinor(selected.priceMinor, currency)}
            </span>
            <Button
              onClick={onAdd}
              disabled={isPending || selected.availability === "out_of_stock"}
              aria-label={`Add to cart — ${formatMinor(selected.priceMinor, currency)}`}
            >
              {isPending ? "Adding…" : "Add to cart"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotifyMeRow({ variant }: { variant: VariantDto }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await notifyBackInStockAction({ variantId: variant.id, email });
      setMessage(
        result.ok
          ? result.data.status === "already_registered"
            ? "You are already on the list."
            : "You are on the list — we will email you when it is back in stock."
          : result.error.message,
      );
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-label={`Notify me — ${variant.color ?? variant.sku}`}
      className="rounded-card border border-line bg-bg-2 p-4"
    >
      <p className="text-sm text-ink-2">
        <span className="font-medium">{variant.color ?? variant.sku}</span> is out of stock —
        we will let you know when it returns.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`notify-${variant.id}`} className="sr-only">
          {`Notify me — ${variant.color ?? variant.sku}`}
        </label>
        <Input
          id={`notify-${variant.id}`}
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
          autoComplete="email"
        />
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Saving…" : "Notify me"}
        </Button>
      </div>
      {message ? (
        <p role="status" className="mt-2 text-sm text-ink-2">
          {message}
        </p>
      ) : null}
    </form>
  );
}
