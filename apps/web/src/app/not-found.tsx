import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-32 text-center md:px-8">
      <p className="text-sm uppercase tracking-[0.2em] text-accent-2">404</p>
      <h1 className="mt-3 font-display text-4xl">This page has wandered off</h1>
      <p className="mt-4 text-md text-ink-2">
        The page you are looking for does not exist or has moved.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/shop"
          className="rounded-pill bg-accent-2 px-6 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          Browse the shop
        </Link>
        <Link
          href="/"
          className="rounded-pill border border-line px-6 py-3 text-sm font-medium text-ink hover:bg-bg-2"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
