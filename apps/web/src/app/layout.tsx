import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { getCartDto } from "@scandihaven/commerce/cart-service";
import { getCartId } from "@/lib/cart-session";
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
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cartId = await getCartId();
  const cart = cartId ? await getCartDto(cartId).catch(() => null) : null;

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col bg-bg text-ink font-ui">
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
