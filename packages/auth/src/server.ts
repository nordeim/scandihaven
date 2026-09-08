import { db } from "@scandihaven/db/client";
import { AUTH_TABLE_NAMES } from "@scandihaven/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";

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
