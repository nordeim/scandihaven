/**
 * Client-side Stripe configuration check (PRD FR-508; live E2E audit
 * round 8, R8-1). Mirrors the server rule in
 * `packages/commerce/src/checkout-service.ts::getStripe()`:
 * a key containing the `set-me` sentinel is a placeholder from
 * `.env.example`, not a configured environment. Without this mirror the
 * deployment rendered the full checkout form and failed after submission
 * with an internal config message (R8-1).
 */
export function isStripePublishableKeyConfigured(key: string | undefined): boolean {
  return Boolean(key) && !key?.includes("set-me");
}
