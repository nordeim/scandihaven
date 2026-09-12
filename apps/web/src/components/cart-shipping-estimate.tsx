"use client";

import { useId, useRef, useState } from "react";
import { useTransition } from "react";
import { Input } from "@scandihaven/ui/input";
import { Label } from "@scandihaven/ui/label";
import type { ShippingQuote } from "@scandihaven/commerce/providers";
import { estimateShippingAction } from "@/actions/shipping";
import { formatMinor } from "@/lib/format";

/**
 * Cart shipping estimator (PRD FR-402; R9-3): postcode + country →
 * display-only rate quotes from the shipping-rate provider. Debounced at
 * 400 ms so the estimate lands within the FR-402 500 ms budget after the
 * shopper stops typing; stale responses are dropped by sequence. The
 * estimate never mutates cart totals — the summary's Shipping row still
 * says "Calculated at checkout" (placement keeps shippingMinor: 0).
 */

/** Countries covered by the seeded zones (EU + US + UK). */
const COUNTRIES = [
  { code: "DK", label: "Denmark" },
  { code: "DE", label: "Germany" },
  { code: "SE", label: "Sweden" },
  { code: "NL", label: "Netherlands" },
  { code: "FR", label: "France" },
  { code: "IT", label: "Italy" },
  { code: "ES", label: "Spain" },
  { code: "PL", label: "Poland" },
  { code: "AT", label: "Austria" },
  { code: "BE", label: "Belgium" },
  { code: "FI", label: "Finland" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
] as const;

const METHOD_LABELS: Record<ShippingQuote["method"], string> = {
  standard: "Standard",
  express: "Express",
  white_glove: "White-glove",
  pickup: "Pickup",
};

const DEBOUNCE_MS = 400;

type EstimateResult = {
  quotes: ShippingQuote[];
  currency: string;
} | null;

export function CartShippingEstimate() {
  const countryId = useId();
  const postcodeId = useId();
  const [country, setCountry] = useState<string>("DK");
  const [postcode, setPostcode] = useState("");
  const [estimate, setEstimate] = useState<EstimateResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runEstimate = (nextCountry: string, nextPostcode: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (nextPostcode.trim().length < 3) {
      // Mid-typing guard: a partial postcode is not a destination yet.
      setEstimate(null);
      setError(null);
      return;
    }
    timer.current = setTimeout(() => {
      const requestId = ++seq.current;
      startTransition(async () => {
        const result = await estimateShippingAction({
          country: nextCountry,
          postalCode: nextPostcode,
        });
        // Drop stale responses — the shopper kept typing past the fire.
        if (requestId !== seq.current) return;
        if (result.ok) {
          setEstimate(result.data ? { quotes: result.data.quotes, currency: result.data.currency } : null);
          setError(null);
        } else {
          setEstimate(null);
          setError(result.error.message);
        }
      });
    }, DEBOUNCE_MS);
  };

  const onCountry = (value: string) => {
    setCountry(value);
    runEstimate(value, postcode);
  };

  const onPostcode = (value: string) => {
    setPostcode(value);
    runEstimate(country, value);
  };

  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-sm font-medium text-ink-2">Shipping estimate</p>
      <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
        <div>
          <Label htmlFor={countryId} className="sr-only">
            Country
          </Label>
          <select
            id={countryId}
            value={country}
            onChange={(e) => onCountry(e.target.value)}
            className="h-10 w-full rounded-card border border-line bg-transparent px-3 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={postcodeId} className="sr-only">
            Postcode
          </Label>
          <Input
            id={postcodeId}
            inputMode="text"
            autoComplete="postal-code"
            placeholder="Postcode"
            value={postcode}
            onChange={(e) => onPostcode(e.target.value)}
          />
        </div>
      </div>
      <div role="status" aria-label="Shipping estimate" aria-busy={isPending} className="mt-2 text-sm">
        {error ? (
          <p className="text-muted">{error}</p>
        ) : estimate === null ? (
          <p className="text-muted">Enter your postcode for delivery options.</p>
        ) : estimate.quotes.length === 0 ? (
          <p className="text-muted">
            We don&apos;t have rates for this destination yet — see our shipping page.
          </p>
        ) : (
          <ul className="space-y-1">
            {estimate.quotes.map((quote) => (
              <li key={quote.method} className="flex items-baseline justify-between gap-2">
                <span className="text-muted">
                  {METHOD_LABELS[quote.method]}
                  {quote.method === "pickup" ? " · " : ` — ${quote.etaDaysMin}–${quote.etaDaysMax} days · `}
                  {quote.amountMinor === 0
                    ? "Free"
                    : formatMinor(quote.amountMinor, estimate.currency)}
                </span>
                {quote.forced ? (
                  <span className="text-xs text-muted">included for heavy pieces</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
