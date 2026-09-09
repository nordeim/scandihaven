import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@scandihaven/auth/server";
import { parseRoles } from "@scandihaven/auth/rbac";

export const metadata: Metadata = {
  title: "Back office",
};

/**
 * Staff layout (PRD §9.2): gate + chrome for every admin surface except
 * /sign-in (which lives outside this route group). Unauthenticated visitors
 * are bounced with a redirect target; permission checks themselves stay
 * server-side in Server Actions via requirePermission() — this gate is UX.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    redirect("/sign-in");
  }
  const roles = parseRoles(session.user.role);
  const isStaff = roles.some((r) => r !== "user");
  if (!isStaff) {
    return (
      <main className="mx-auto max-w-lg px-5 py-32 text-center">
        <h1 className="font-display text-3xl">No back-office access</h1>
        <p className="mt-4 text-md text-muted">
          Your account does not have staff permissions. Ask an owner to grant a role.
        </p>
      </main>
    );
  }

  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/products", label: "Products" },
    { href: "/orders", label: "Orders" },
    { href: "/customers", label: "Customers" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-display text-lg">
              SH Admin
            </Link>
            <nav aria-label="Admin" className="flex gap-5 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-ink-2 transition-colors hover:text-accent-2"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <span className="text-sm text-muted">
            {session.user.email} · {roles.join(", ")}
          </span>
        </div>
      </header>
      <main className="flex-1 bg-bg-2/50">{children}</main>
    </div>
  );
}
