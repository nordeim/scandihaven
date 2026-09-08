import type { Currency } from "@scandihaven/commerce/money";

/**
 * Locale-aware money formatting (PRD §7.2: integers in the domain,
 * Intl at the edge). Fixed en-DASH thousands for scaffold consistency;
 * production passes request locale.
 */
const LOCALE_BY_CURRENCY: Record<string, string> = {
  EUR: "en-IE",
  USD: "en-US",
  GBP: "en-GB",
  DKK: "da-DK",
  SEK: "sv-SE",
};

export function formatMinor(amount: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] ?? "en-IE", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export type { Currency };
