import { describe, expect, it } from "vitest";
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  isStaleChunkError,
  shouldHardReload,
} from "./chunk-recovery";

/**
 * Live E2E audit 2026-09-10, E2E-1: the live /checkout crashed with
 * ChunkLoadError because the deployment rebuilt without restarting — the old
 * process rendered HTML referencing purged build chunks. The boundaries
 * self-heal with one hard reload; these pin the reload decision.
 */
describe("chunk recovery (E2E-1)", () => {
  it("recognises stale-chunk failures across bundler phrasings", () => {
    expect(isStaleChunkError("ChunkLoadError: failed to load chunk")).toBe(true);
    expect(isStaleChunkError("Failed to load chunk /_next/static/chunks/a.js")).toBe(true);
    expect(isStaleChunkError("Loading chunk 44909 failed")).toBe(true);
    expect(isStaleChunkError("error: dynamically imported module timeout")).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isStaleChunkError("Cannot read properties of undefined")).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError("")).toBe(false);
  });

  it("reloads once, then holds a cooldown before considering another reload", () => {
    const message = "Failed to load chunk /_next/static/chunks/a.js";
    const now = 1_000_000;
    expect(shouldHardReload(message, now, null)).toBe(true);
    expect(shouldHardReload(message, now, now - 1)).toBe(false);
    expect(shouldHardReload(message, now, now - CHUNK_RELOAD_COOLDOWN_MS)).toBe(true);
  });

  it("never reloads for unrelated errors regardless of history", () => {
    expect(shouldHardReload("TypeError: x is undefined", 1_000_000, null)).toBe(false);
  });
});
