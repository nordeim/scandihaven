import { db } from "@scandihaven/db/client";
import { AUTH_TABLE_NAMES } from "@scandihaven/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";

import { requestOriginFromHeaders } from "./trusted-origins";

/**
 * Better-Auth server instance (PRD §9.1, ADR-3).
 * - Email/password (min length 10) + magic link + Google/Apple OAuth (when env present).
 * - DB-backed sessions so admin revocation is immediate (FR-609).
 * - Admin plugin provides the `role`, `banned`, `banReason`, `banExpires` fields.
 * - Fine-grained Scandi Haven roles live in ./rbac and read `user.role`.
 *
 * Phase 1 (PRD §13.6): enable the two-factor plugin for Owner/Admin — tracked in
 * the verification ledger; scaffold ships without it so no unverified plugin
 * schema is guessed (engineering standards §7).
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: AUTH_TABLE_NAMES,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  url: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  // Trust the origin each request was served on, derived from
  // proxy-controlled headers (audit 2026-09-09 H-AUTH: sign-in from the
  // deployed origin failed "Invalid origin" while the trusted set was pinned
  // to BETTER_AUTH_URL=localhost). `Origin`/`Referer` are never consulted —
  // see ./trusted-origins for the CSRF reasoning. Deployments that prefer an
  // explicit allow-list can set BETTER_AUTH_URL to the public origin and/or
  // the native BETTER_AUTH_TRUSTED_ORIGINS (comma-separated); both merge with
  // this hook.
  trustedOrigins: (request: Request | undefined) => {
    const served = requestOriginFromHeaders(request?.headers ?? null);
    return served ? [served] : [];
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  socialProviders: {
    ...(process.env.AUTH_GOOGLE_ID
      ? {
          google: {
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
          },
        }
      : {}),
    ...(process.env.AUTH_APPLE_ID
      ? {
          apple: {
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET ?? "",
          },
        }
      : {}),
  },
  plugins: [admin()],
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
      marketingOptIn: { type: "boolean", required: false, input: true, defaultValue: false },
      tradeStatus: { type: "string", required: false, input: false },
      stripeCustomerId: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days (PRD §9.1)
    updateAge: 60 * 60 * 24, // refresh daily
  },
  // Cookie flags (HttpOnly, SameSite=Lax, Secure in production) are Better-Auth
  // secure defaults — no override needed (PRD §9.1).
});

export type Session = typeof auth.$Infer.Session;
