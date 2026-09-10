"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Drawer, DrawerContent, DrawerTrigger } from "@scandihaven/ui/drawer";

const NAV_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/collections", label: "Collections" },
  { href: "/search", label: "Search" },
  { href: "/our-story", label: "Our Story" },
  { href: "/journal", label: "Journal" },
] as const;

/**
 * Mobile navigation drawer (PRD FR-102; live E2E audit 2026-09-10, E2E-6):
 * the primary nav is `hidden md:flex`, so below 768px no navigation existed
 * at all. Radix-backed drawer (focus-trapped, Esc/scrim close, scroll lock —
 * the FR-102 a11y floor the primitive documents); links close the drawer so
 * the customer lands on the page they chose. The Search link (round 6, R6-2,
 * FR-104) mirrors the desktop header combobox, which is hidden below md.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        aria-label="Open menu"
        className="rounded-pill p-2 text-ink transition-colors hover:bg-bg-2 md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </DrawerTrigger>
      <DrawerContent side="left" title="Menu" className="w-72 max-w-[85vw] p-6">
        <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-card px-3 py-3 text-lg text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
