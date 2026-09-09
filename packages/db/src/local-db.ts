/**
 * Local-host guard for DB lifecycle scripts (AGENTS.md: migrate/seed/reset
 * "local hosts only"; audit 2026-09-09 M6d — db:migrate ran unguarded).
 * Destructive or dev-only operations must never hit a shared cluster.
 */

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1"]);

/** True when the connection string points at a local development database. */
export function isLocalDatabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    // WHATWG URL keeps IPv6 brackets in .hostname ("[::1]") — strip them.
    const host = new URL(url).hostname.replace(/^\[/, "").replace(/\]$/, "");
    return LOCAL_HOSTS.has(host);
  } catch {
    return false;
  }
}

/** Throws with an actionable message when DATABASE_URL is not local. */
export function assertLocalDatabase(url: string = process.env.DATABASE_URL ?? ""): void {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^\[/, "").replace(/\]$/, "");
  } catch {
    throw new Error(
      `DATABASE_URL is not a valid connection string (got: "${url.replace(/:[^:@]*@/, ":***@")}").`,
    );
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run against non-local database host "${host}". ` +
        "Lifecycle scripts (migrate/seed/reset) are for development only (PRD §13.7).",
    );
  }
}
