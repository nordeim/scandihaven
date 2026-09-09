/**
 * Stale-chunk self-heal (live E2E audit 2026-09-10, E2E-1): after a redeploy
 * built WITHOUT restarting the server, a cached page hydrates against
 * references to purged build chunks and the route dies with a ChunkLoadError.
 * One hard reload fetches the fresh document and chunk graph; the timestamp
 * guard keeps a persistent failure from reload-looping.
 */

export const CHUNK_RELOAD_FLAG = "sh:chunk-reload-at";

/** Window (ms) within which a second chunk failure will NOT trigger another reload. */
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

export function isStaleChunkError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /ChunkLoadError|Failed to load chunk|Loading chunk|dynamically imported module/i.test(
    message,
  );
}

/**
 * Pure decision: should this chunk failure trigger a hard reload?
 * `now`/`lastReloadAt` are injectable so the decision is testable without a
 * browser; the runner below reads/writes the timestamp for real callers.
 */
export function shouldHardReload(
  message: string | undefined | null,
  now: number,
  lastReloadAt: number | null,
): boolean {
  if (!isStaleChunkError(message)) return false;
  if (lastReloadAt === null) return true;
  return now - lastReloadAt >= CHUNK_RELOAD_COOLDOWN_MS;
}

/**
 * Browser runner used from error boundaries. Returns true when it initiated a
 * reload (the component should render nothing further). All storage access is
 * guarded — sandboxed/blocked storage must not throw, and an unavailable
 * sessionStorage disables the reload (never risk a loop).
 */
export function reloadOnStaleChunk(error: Error): boolean {
  let lastReloadAt: number | null = null;
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_FLAG);
    lastReloadAt = raw === null ? null : Number(raw);
  } catch {
    return false; // storage unavailable — do not reload
  }
  if (!shouldHardReload(error.message, Date.now(), lastReloadAt)) return false;
  try {
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()));
  } catch {
    // the reload below still fetches fresh chunks; the flag is best-effort
  }
  window.location.reload();
  return true;
}
