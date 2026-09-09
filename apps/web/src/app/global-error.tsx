"use client";

import { useEffect } from "react";
import { reloadOnStaleChunk } from "@scandihaven/config/chunk-recovery";

/**
 * Root error boundary (PRD FR-109; live E2E audit 2026-09-10, E2E-1): errors
 * that escape the route-segment boundary — root-layout failures, stale
 * ChunkLoadError from a rebuild-without-restart — used to render Next.js's
 * unbranded default UI. This keeps the FR-109 honest-copy contract at the
 * root. global-error replaces the root layout, so it renders <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Stale-chunk self-heal: a hard reload fetches the fresh document (and
    // chunk graph) instead of stranding the customer on the error; the
    // cooldown guard inside the helper prevents a reload loop.
    reloadOnStaleChunk(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-bg text-ink antialiased">
        <div className="mx-auto max-w-2xl px-5 py-32 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-accent-2">Something went wrong</p>
          <h1 className="mt-3 font-display text-4xl">An unexpected error occurred</h1>
          <p className="mt-4 text-md text-ink-2">
            We have logged the issue{error.digest ? ` (ref: ${error.digest})` : ""}. Please try
            again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-pill bg-accent-2 px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
