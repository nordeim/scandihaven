import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { getCartDto } from "@scandihaven/commerce/cart-service";
import { safeJsonLd } from "@scandihaven/commerce/rich-text";
import { getCartId } from "@/lib/cart-session";
import { organizationJsonLd, webSiteJsonLd, DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { currentSiteUrl } from "@/lib/site-origin";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Metadata origin is resolved PER REQUEST (round 5, R5-2 — completing the
// round-4 R4-6 seam): a static `metadataBase: new URL(env ?? localhost)` is
// evaluated at build time, so a deployment without NEXT_PUBLIC_SITE_URL set
// advertised http://localhost:3000 as og:url on every page except the PDP
// (which already resolves request-scoped). Storefront routes are
// request-dynamic (the root layout reads the cart cookie), so awaiting
// headers() here adds no new dynamic surface.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await currentSiteUrl();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: DEFAULT_TITLE,
      template: "%s | Scandi Haven",
    },
    description: DEFAULT_DESCRIPTION,
    // PRD §11.1: per-page og:*, twitter:* (round 4, R4-7 — the home page
    // previously emitted no social metadata at all). og:url stays relative so
    // the Next Metadata API resolves it against metadataBase per page.
    // Public pages override this via `publicPageMetadata` (round 5, R5-2),
    // which emits the FULL object — Next replaces a segment's openGraph
    // wholesale, so a partial override would drop these fields.
    openGraph: {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      type: "website",
      url: "/",
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [cartId, siteUrl] = await Promise.all([getCartId(), currentSiteUrl()]);
  const cart = cartId ? await getCartDto(cartId).catch((error: unknown) => { console.error("[layout] cart load failed", error); return null; }) : null;

  // Sitewide structured data (PRD §11.1, round 4 R4-8): Organization +
  // WebSite/SearchAction — request-scoped origin so the absolute URLs are
  // correct even when NEXT_PUBLIC_SITE_URL is unset (R4-6).
  const orgLd = safeJsonLd(organizationJsonLd(siteUrl));
  const siteLd = safeJsonLd(webSiteJsonLd(siteUrl));

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col bg-bg text-ink font-ui">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: orgLd }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: siteLd }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-bg-2 focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <CartDrawer cart={cart} />
      </body>
    </html>
  );
}
