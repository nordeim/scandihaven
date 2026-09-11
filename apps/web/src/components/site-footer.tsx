import Link from "next/link";

import { NewsletterForm } from "@/components/newsletter-form";

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

// FR-107 (round 8, R8-4): the footer newsletter was planned (the subscribe
// action's `source` defaults to "footer") but never rendered; social icons
// were missing too. External brand links, safely isolated.
const socialLinks = [
  { href: "https://instagram.com/scandihaven", label: "Instagram" },
  { href: "https://pinterest.com/scandihaven", label: "Pinterest" },
  { href: "https://facebook.com/scandihaven", label: "Facebook" },
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
          <p className="text-sm font-medium uppercase tracking-wide text-ink">Stay in touch</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Slow letters, four times a year. No noise.
          </p>
          <NewsletterForm source="footer" idPrefix="footer-newsletter" compact />
          <ul className="mt-5 flex gap-4 text-sm text-ink-2">
            {socialLinks.map((social) => (
              <li key={social.href}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-2"
                >
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Visa · Mastercard · Amex · Apple Pay · Klarna</p>
        </div>
      </div>
      <div className="border-t border-line px-5 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Scandi Haven ApS · CVR 41 22 98 17
      </div>
    </footer>
  );
}
