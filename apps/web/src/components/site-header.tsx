import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { announcement } from "@scandihaven/db/schema";
import { getCartDto } from "@scandihaven/commerce/cart-service";
import { getCartId } from "@/lib/cart-session";
import { CartTrigger } from "@/components/cart-trigger";
import { MobileNav } from "@/components/mobile-nav";

/**
 * Global header (PRD FR-101): announcement bar, primary nav, account, cart.
 * The cart count renders server-side and refreshes via RSC revalidation after
 * cart mutations — no client data-fetching layer (PRD §8.1).
 */
export async function SiteHeader() {
  const announcements = await db
    .select({ message: announcement.message, href: announcement.href })
    .from(announcement)
    .where(eq(announcement.isActive, true))
    .orderBy(announcement.sortOrder)
    .limit(1)
    .catch((error: unknown) => { console.error("[site-header] nav load failed", error); return [] as never; });

  const cartId = await getCartId();
  const cartData = cartId ? await getCartDto(cartId).catch((error: unknown) => { console.error("[site-header] cart load failed", error); return null; }) : null;
  const itemCount = cartData?.lines.reduce((acc, l) => acc + l.qty, 0) ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      {announcements[0] ? (
        <div className="bg-dark px-4 py-2 text-center text-xs text-bg">
          {announcements[0].href ? (
            <Link href={announcements[0].href} className="hover:underline">
              {announcements[0].message}
            </Link>
          ) : (
            announcements[0].message
          )}
        </div>
      ) : null}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:px-8">
        {/* Order is logo / mobile menu / spacer actions — the menu sits with
            the logo block on the left like the nav it stands in for. */}
        <div className="flex items-center gap-1">
          <MobileNav />
          <Link href="/" className="font-display text-xl tracking-tight">
            Scandi Haven
          </Link>
        </div>

        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm md:flex">
          <Link href="/shop" className="text-ink-2 transition-colors hover:text-accent-2">
            Shop
          </Link>
          <Link href="/collections" className="text-ink-2 transition-colors hover:text-accent-2">
            Collections
          </Link>
          <Link href="/our-story" className="text-ink-2 transition-colors hover:text-accent-2">
            Our Story
          </Link>
          <Link href="/journal" className="text-ink-2 transition-colors hover:text-accent-2">
            Journal
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="rounded-pill px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
          >
            Account
          </Link>
          <CartTrigger itemCount={itemCount} />
        </div>
      </div>
    </header>
  );
}
