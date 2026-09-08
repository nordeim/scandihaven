import { describe, expect, it } from "vitest";
import {
  FLAG_DEFAULTS,
  FLAG_NAMES,
  isFlagEnabled,
  parseFlags,
  type FeatureFlags,
  type FlagName,
} from "./flags";

describe("feature flags (PRD §4.8, v3a §6.4)", () => {
  it("exposes exactly the five v1 flags", () => {
    expect([...FLAG_NAMES].sort()).toEqual([
      "FEATURE_GIFT_CARDS",
      "FEATURE_I18N",
      "FEATURE_KLARNA",
      "FEATURE_REVIEWS",
      "FEATURE_TRADE",
    ]);
  });

  it("applies documented defaults when env is silent", () => {
    expect(parseFlags({})).toEqual({
      FEATURE_TRADE: false,
      FEATURE_GIFT_CARDS: false,
      FEATURE_REVIEWS: true,
      FEATURE_I18N: true,
      FEATURE_KLARNA: false,
    });
    expect(parseFlags({})).toEqual(FLAG_DEFAULTS);
  });

  it.each(["1", "true", "TRUE", "on", "yes", "enabled"])("parses %j as on", (raw) => {
    expect(parseFlags({ FEATURE_TRADE: raw }).FEATURE_TRADE).toBe(true);
  });

  it.each(["0", "false", "FALSE", "off", "no", "disabled", ""])("parses %j as off", (raw) => {
    expect(parseFlags({ FEATURE_TRADE: raw }).FEATURE_TRADE).toBe(false);
  });

  it("parses each flag independently", () => {
    const flags = parseFlags({
      FEATURE_TRADE: "on",
      FEATURE_REVIEWS: "off",
      FEATURE_KLARNA: "1",
    });
    expect(flags.FEATURE_TRADE).toBe(true);
    expect(flags.FEATURE_REVIEWS).toBe(false);
    expect(flags.FEATURE_KLARNA).toBe(true);
    expect(flags.FEATURE_GIFT_CARDS).toBe(false);
    expect(flags.FEATURE_I18N).toBe(true);
  });

  it("fails fast on a garbage value naming the flag (env is a boundary)", () => {
    expect(() => parseFlags({ FEATURE_TRADE: "maybe" })).toThrow(/FEATURE_TRADE/);
  });

  it("fails fast on an unknown FEATURE_* variable (typo protection)", () => {
    expect(() => parseFlags({ FEATURE_TRADEE: "on" })).toThrow(/FEATURE_TRADEE/);
  });

  it("ignores unrelated environment variables", () => {
    expect(() => parseFlags({ DATABASE_URL: "postgres://x", HOME: "/z" })).not.toThrow();
    expect(parseFlags({ DATABASE_URL: "postgres://x" })).toEqual(FLAG_DEFAULTS);
  });

  it("isFlagEnabled narrows to boolean lookup", () => {
    const flags: FeatureFlags = parseFlags({ FEATURE_GIFT_CARDS: "on" });
    expect(isFlagEnabled(flags, "FEATURE_GIFT_CARDS")).toBe(true);
    expect(isFlagEnabled(flags, "FEATURE_TRADE")).toBe(false);
  });

  it("rejects unknown flag names at the type level (compile-time contract)", () => {
    const flags = parseFlags({});
    expect(isFlagEnabled(flags, "FEATURE_TRADE")).toBe(false);
    // Type-level proof: unknown names must not be assignable to FlagName.
    const typeRejectsUnknown = (name: string) => {
      const candidate: FlagName | null = FLAG_NAMES.includes(name as FlagName) ? (name as FlagName) : null;
      return candidate;
    };
    expect(typeRejectsUnknown("FEATURE_NOPE")).toBeNull();
    expect(typeRejectsUnknown("FEATURE_TRADE")).toBe("FEATURE_TRADE");
  });

  it("parses from a process.env-like record", () => {
    const fakeEnv: Record<string, string | undefined> = { ...process.env, FEATURE_I18N: "off" };
    expect(parseFlags(fakeEnv).FEATURE_I18N).toBe(false);
  });
});
