"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-32 text-center md:px-8">
      <p className="text-sm uppercase tracking-[0.2em] text-accent-2">Something went wrong</p>
      <h1 className="mt-3 font-display text-4xl">An unexpected error occurred</h1>
      <p className="mt-4 text-md text-ink-2">
        We have logged the issue{error.digest ? ` (ref: ${error.digest})` : ""}. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-pill bg-accent-2 px-6 py-3 text-sm font-medium text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
