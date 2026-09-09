import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { getCartDto } from "@scandihaven/commerce/cart-service";
import { safeJsonLd } from "@scandihaven/commerce/rich-text";
import { getCartId } from "@/lib/cart-session";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Scandi Haven — Slow Living, Beautifully Made",
    template: "%s | Scandi Haven",
  },
  description:
    "Scandi Haven crafts understated furniture, lighting and textiles for the slow-living home. Sustainably made in Northern Europe.",
  // PRD §11.1: per-page og:*, twitter:* (round 4, R4-7 — the home page
  // previously emitted no social metadata at all). og:url stays relative so
  // the Next Metadata API resolves it against metadataBase per page.
  openGraph: {
    title: "Scandi Haven — Slow Living, Beautifully Made",
    description:
      "Scandi Haven crafts understated furniture, lighting and textiles for the slow-living home. Sustainably made in Northern Europe.",
    type: "website",
    url: "/",
    siteName: "Scandi Haven",
  },
  twitter: {
    card: "summary",
    title: "Scandi Haven — Slow Living, Beautifully Made",
    description:
      "Scandi Haven crafts understated furniture, lighting and textiles for the slow-living home. Sustainably made in Northern Europe.",
  },
};

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
