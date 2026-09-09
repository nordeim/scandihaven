import { z } from "zod";

/**
 * Same-origin redirect-path validator for post-authentication navigation
 * (PRD FR-602; live E2E audit 2026-09-10, E2E-5). Sign-in pages accept a
 * `?redirect=` query param and must never turn it into an off-origin
 * navigation: only in-app absolute paths are allowed — no scheme-relative
 * (`//host`), no backslashes that browsers normalize to scheme-relative, no
 * control characters that split a URL. The admin previously pushed the raw
 * param into `router.push()` (open redirect); both apps share this validator.
 */
const redirectPathSchema = z
  .string()
  // Control characters and whitespace can smuggle separators or new schemes.
  .refine((value) => !/[\u0000-\u001f\u007f\s]/.test(value), "control characters")
  .refine((value) => value.startsWith("/"), "must be root-relative")
  // Any `//` is rejected, not just a leading one: a scheme-relative URL in a
  // query value (`?next=//host`) is only exploitable if an in-app route
  // re-redirects on it, and no legitimate in-app path contains `//` —
  // strictness here costs nothing and closes the whole class.
  .refine((value) => !value.includes("//"), "scheme-relative URL")
  .refine((value) => !value.includes("\\"), "backslash in path")
  .refine((value) => !/^[a-z][a-z0-9+.-]*:/i.test(value.slice(1)), "embedded scheme");

const FALLBACK_REDIRECT = "/account";

export type RedirectPathResult =
  | { ok: true; path: string }
  | { ok: false };

/**
 * Validate a user-supplied redirect target. Returns `{ ok: true, path }` for
 * in-app paths, `{ ok: false }` for anything else — callers substitute their
 * own safe default (storefront `/account`, admin `/`).
 */
export function validateRedirectPath(
  raw: string | null | undefined,
  fallback = FALLBACK_REDIRECT,
): RedirectPathResult {
  if (raw === null || raw === undefined || raw === "") return { ok: true, path: fallback };
  const parsed = redirectPathSchema.safeParse(raw);
  return parsed.success ? { ok: true, path: raw } : { ok: false };
}
