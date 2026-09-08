/**
 * Provider ports (PRD v4 §4.8, adapted from v3a §6.3): every vendor-class
 * dependency enters the domain through an interface, even when v1 has exactly
 * one implementation. New vendors MUST implement the port; call sites MUST
 * NOT import vendor SDKs outside their adapter (ADR-4/6/7 swap discipline).
 *
 * Ports defined here: SearchProvider (bound to Postgres FTS in
 * ./search-provider), ConsentProvider (local internal implementation for
 * pre-launch; Cookiebot/OneTrust adapters land with the consent banner),
 * TaxProvider (Stripe Tax adapter lives in checkout-service, FR-506),
 * ShippingRateProvider (rates-table adapter, FR-402/507), EmailProvider
 * (React Email + Resend adapter composed in the app layer from
 * @scandihaven/email — vendor SDK never leaves that package), JobRunner
 * (Postgres outbox runner in ./jobs, ADR-8).
 */

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchLocale = "en" | "da" | "de" | "sv";

export type SearchQuery = {
  q: string;
  locale?: SearchLocale;
  /** Route contract §8.4: typeahead returns at most 10 rows. */
  limit?: number;
  cursor?: string | null;
};

export type SearchHit = {
  slug: string;
  title: string;
  kind: "product" | "category" | "journal";
};

export type SearchResult = {
  hits: SearchHit[];
  /** v1 typeahead is stateless; reserved for the managed-search swap. */
  nextCursor: string | null;
};

export interface SearchProvider {
  search(query: SearchQuery): Promise<SearchResult>;
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

export type ConsentCategory = "necessary" | "functional" | "analytics" | "marketing";

export type ConsentState = Record<ConsentCategory, boolean>;

export interface ConsentProvider {
  /** Current consent state (banner hydration + analytics gate). */
  load(): ConsentState;
  has(category: ConsentCategory): boolean;
  grant(category: ConsentCategory): void;
  revoke(category: ConsentCategory): void;
  /** Subscribe to changes; returns an unsubscribe function. */
  onChange(listener: (state: ConsentState) => void): () => void;
}

/**
 * Local internal consent provider (PRD §3.2: soft-launch runs this before the
 * Cookiebot adapter goes live — same port, so the vendor swap is mechanical).
 * Persistence is the host's job (localStorage behind a consent gate in the
 * banner component); this implementation is a pure state holder.
 */
export function createLocalConsentProvider(initial?: Partial<ConsentState>): ConsentProvider {
  let state: ConsentState = {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    ...initial,
  };
  state.necessary = true; // strictly-necessary consent is never downgradeable
  const listeners = new Set<(state: ConsentState) => void>();

  const notify = () => {
    for (const listener of listeners) listener({ ...state });
  };

  return {
    load: () => ({ ...state }),
    has: (category) => state[category],
    grant: (category) => {
      state = { ...state, [category]: true };
      notify();
    },
    revoke: (category) => {
      if (category === "necessary") {
        throw new Error("Strictly-necessary consent cannot be revoked.");
      }
      state = { ...state, [category]: false };
      notify();
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tax (Stripe Tax in v1 — FR-506)
// ---------------------------------------------------------------------------

export type TaxQuoteInput = {
  lines: { id: string; unitPriceMinor: number; qty: number; taxCode?: string }[];
  address: { postalCode: string; country: string; region: "EU" | "US" | "UK" };
  currency: string;
  /** EU display is VAT-inclusive; US/UK add tax at checkout (§7.2). */
  taxInclusive: boolean;
};

export type TaxQuoteResult = {
  taxMinor: number;
  inclusive: boolean;
  breakdown: { name: string; rateBp: number }[];
};

export interface TaxProvider {
  quote(input: TaxQuoteInput): Promise<TaxQuoteResult>;
}

// ---------------------------------------------------------------------------
// Shipping rates (rates table + white-glove rule in v1 — FR-402/507)
// ---------------------------------------------------------------------------

export type ShippingMethod = "standard" | "express" | "white_glove" | "pickup";

export type ShippingQuoteInput = {
  postalCode: string;
  country: string;
  region: "EU" | "US" | "UK";
  currency: string;
  weightG: number;
  subtotalMinor: number;
};

export type ShippingQuote = {
  method: ShippingMethod;
  amountMinor: number;
  etaDaysMin: number;
  etaDaysMax: number;
  /** White-glove is force-selected above the 30 kg threshold (FR-409/507). */
  forced?: boolean;
};

export interface ShippingRateProvider {
  quote(input: ShippingQuoteInput): Promise<ShippingQuote[]>;
}

// ---------------------------------------------------------------------------
// Email (React Email + Resend adapter in packages/email — FR-910)
// ---------------------------------------------------------------------------

export type EmailTemplate =
  | "order-confirmation"
  | "shipment-update"
  | "review-request"
  | "return-status"
  | "back-in-stock";

export type EmailMessage = {
  template: EmailTemplate;
  to: string;
  data: Record<string, unknown>;
};

export type EmailSendResult = { transport: "resend" | "log"; id: string | null };

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

// ---------------------------------------------------------------------------
// Jobs (outbox runner — ADR-8; implementation in ./jobs)
// ---------------------------------------------------------------------------

export type JobSpec = {
  kind: string;
  payload: unknown;
  runAfter?: Date;
  /** Stable idempotency key; unique per (kind, dedupeKey). */
  dedupeKey?: string;
};

export type DrainResult = { processed: number; failed: number; dead: number };

export interface JobRunner {
  enqueue(spec: JobSpec): Promise<void>;
  drain(options?: { limit?: number; now?: Date }): Promise<DrainResult>;
}
