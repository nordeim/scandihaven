/**
 * Per-instance request dedupe for idempotent Server Actions (PRD §8.3):
 * `cart.addLine` carries a client-generated `requestId` deduplicated within a
 * 5-minute window so double-taps and optimistic-UI retries cannot double-add.
 *
 * Scope note (honest v1 fidelity): entries live in process memory, so the
 * guarantee is per server instance. The documented v1.1 upgrade path moves the
 * key into a `cart_request_dedupe` table with a TTL sweep for multi-instance
 * deployments (PRD Appendix B).
 */
export type RequestDedupe = {
  /** True = first sighting, caller proceeds. False = duplicate within window. */
  checkAndReserve(key: string, now?: number): boolean;
  size(): number;
};

export function createRequestDedupe(windowMs: number): RequestDedupe {
  const seen = new Map<string, number>();

  return {
    checkAndReserve(key, now = Date.now()) {
      if (key.endsWith(":") || key === "") return true; // no requestId → always process

      // Lazily evict expired entries on every call (amortized O(n), n small).
      for (const [k, expiresAt] of seen) {
        if (expiresAt <= now) seen.delete(k);
      }

      const expiresAt = seen.get(key);
      if (expiresAt !== undefined && expiresAt > now) return false;

      seen.set(key, now + windowMs);
      return true;
    },
    size() {
      return seen.size;
    },
  };
}
