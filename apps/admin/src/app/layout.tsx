import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout: shell only. The auth gate + chrome live in the `(staff)`
 * route group so `/sign-in` renders ungated — the previous layout-level
 * redirect to /sign-in wrapped sign-in itself and produced an infinite
 * redirect loop for sessionless visitors (audit 2026-09-09 H7d; observed
 * live as ERR_TOO_MANY_REDIRECTS on the deployed admin).
 */
export const metadata: Metadata = {
  title: { default: "Scandi Haven Admin", template: "%s · SH Admin" },
  robots: { index: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
