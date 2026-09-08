import Link from "next/link";

const helpLinks = [
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns" },
  { href: "/faq", label: "FAQ" },
];

const aboutLinks = [
  { href: "/our-story", label: "Our Story" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/** Footer (PRD FR-107): link groups, showroom address, payment marks, legal. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-bg-2">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 md:px-8">
        <div>
          <p className="font-display text-lg">Scandi Haven</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Slow living, beautifully made. Handcrafted furniture, lighting, textiles and
            ceramics from Northern Europe.
          </p>
          <p className="mt-4 text-sm text-muted">
            Showroom: Vestre Havnegade 4, 9000 Aalborg, Denmark
            <br />
            Open Tue–Sat, 10–17
          </p>
        </div>

        <nav aria-label="Shop help">
          <p className="text-sm font-medium uppercase tracking-wide text-ink">Help</p>
          <ul className="mt-3 space-y-2 text-sm">
            {helpLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-2 hover:text-accent-2">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="About">
          <p className="text-sm font-medium uppercase tracking-wide text-ink">About</p>
          <ul className="mt-3 space-y-2 text-sm">
            {aboutLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-2 hover:text-accent-2">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink">Guarantee</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            10-year guarantee on all furniture. Carbon-neutral delivery across the EU.
          </p>
          <p className="mt-4 text-xs text-muted">Visa · Mastercard · Amex · Apple Pay · Klarna</p>
        </div>
      </div>
      <div className="border-t border-line px-5 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Scandi Haven ApS · CVR 41 22 98 17
      </div>
    </footer>
  );
}
