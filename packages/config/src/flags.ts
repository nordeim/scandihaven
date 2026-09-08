/**
 * Typed feature flags over environment variables (PRD §4.8, FR-gating contract).
 *
 * Rules:
 * - The flag list is closed; a misspelled `FEATURE_*` env var fails fast at boot,
 *   and passing an unknown name to `isFlagEnabled` fails typecheck.
 * - Parsing is total: `1/true/on/yes/enabled` → on; `0/false/off/no/disabled/""` → off;
 *   anything else is a boundary error naming the offending flag.
 * - Defaults ship the v1 product posture: trade, gift cards, and BNPL are OFF;
 *   reviews and i18n are ON (PRD §4.8).
 */
export const FLAG_NAMES = [
  "FEATURE_TRADE",
  "FEATURE_GIFT_CARDS",
  "FEATURE_REVIEWS",
  "FEATURE_I18N",
  "FEATURE_KLARNA",
] as const;

export type FlagName = (typeof FLAG_NAMES)[number];

export type FeatureFlags = Record<FlagName, boolean>;

export const FLAG_DEFAULTS: FeatureFlags = {
  FEATURE_TRADE: false,
  FEATURE_GIFT_CARDS: false,
  FEATURE_REVIEWS: true,
  FEATURE_I18N: true,
  FEATURE_KLARNA: false,
};

const TRUTHY = new Set(["1", "true", "on", "yes", "enabled"]);
const FALSY = new Set(["0", "false", "off", "no", "disabled", ""]);

function parseFlagValue(name: FlagName, raw: string | undefined): boolean {
  if (raw === undefined) return FLAG_DEFAULTS[name];
  const normalized = raw.trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  throw new Error(
    `Invalid feature flag value for ${name}: ${JSON.stringify(raw)} (expected on/off, true/false, 1/0)`,
  );
}

/**
 * Parse a process.env-like record into a typed flag set.
 * Unknown `FEATURE_*` variables throw (typo protection); unrelated variables are ignored.
 */
export function parseFlags(source: Record<string, string | undefined> = process.env): FeatureFlags {
  const seen = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("FEATURE_")) seen.set(key, value);
  }

  const known = new Set<string>(FLAG_NAMES);
  for (const key of seen.keys()) {
    if (!known.has(key)) {
      throw new Error(
        `Unknown feature flag ${key}. Known flags: ${FLAG_NAMES.join(", ")}. ` +
          `If this is a new flag, add it to packages/config/src/flags.ts first.`,
      );
    }
  }

  const flags = {} as FeatureFlags;
  for (const name of FLAG_NAMES) {
    flags[name] = parseFlagValue(name, seen.get(name));
  }
  return flags;
}

export function isFlagEnabled(flags: FeatureFlags, name: FlagName): boolean {
  return flags[name];
}
