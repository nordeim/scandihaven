/**
 * Integer minor-unit money (ADR-7). Floats never touch money.
 * Formatting happens at the edge via Intl with explicit currency — never here.
 */

export type Currency = "EUR" | "USD" | "GBP" | "DKK" | "SEK";

export class MoneyError extends Error {}

/** Guard arithmetic inputs: integers only, within safe range. */
export function assertMinor(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer, got ${value}`);
  }
  return value;
}

/** Round-half-up (commerce convention) — deterministic for tax/shipping/FX. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) throw new MoneyError(`non-finite amount: ${value}`);
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON);
}

/** Convert a base-EUR minor amount into a target currency using an FX rate snapshot. */
export function convertFromEur(eurMinor: number, rate: string | number): number {
  assertMinor(eurMinor, "eurMinor");
  const numeric = typeof rate === "string" ? Number.parseFloat(rate) : rate;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new MoneyError(`invalid fx rate: ${rate}`);
  }
  return roundHalfUp(eurMinor * numeric);
}

/** Format minor units for display in tests/logs; production UI uses Intl per locale. */
const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set(["JPY", "KRW", "ISK"]);

export function formatMinor(amount: number, currency: Currency): string {
  assertMinor(amount);
  const exponent = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  const divisor = 10 ** exponent;
  const major = amount / divisor;
  return `${major.toFixed(exponent)} ${currency}`;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((acc, v) => {
    assertMinor(v, "summand");
    return acc + v;
  }, 0);
}
