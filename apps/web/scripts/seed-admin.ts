import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@scandihaven/db/client";
import { user } from "@scandihaven/db/schema";
import { auth } from "@scandihaven/auth/server";

/**
 * Idempotent test-admin provisioning (PRD §7.9: credentials never seeded by
 * raw inserts — this goes through Better-Auth's real sign-up + a role update).
 * Password comes from SEED_ADMIN_PASSWORD (required) so no default credential
 * exists anywhere in the repo.
 */
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@scandihaven.test";
const password = process.env.SEED_ADMIN_PASSWORD;

if (!password || password.length < 10) {
  console.error(
    "[seed:admin] set SEED_ADMIN_PASSWORD (>= 10 chars) to provision the test admin. " +
      "No default password ships in the repo.",
  );
  process.exit(1);
}

try {
  const existing = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (existing[0]) {
    if (existing[0].role !== "owner") {
      await db
        .update(user)
        .set({ role: "owner", emailVerified: true })
        .where(eq(user.id, existing[0].id));
      console.info(`[seed:admin] promoted ${email} to owner`);
    } else {
      console.info(`[seed:admin] ${email} is already an owner`);
    }
  } else {
    const result = await auth.api.signUpEmail({
      body: { email, password, name: "Studio Owner" },
    });
    if (!result?.user) throw new Error("Better-Auth sign-up returned no user");
    await db.update(user).set({ role: "owner", emailVerified: true }).where(eq(user.email, email));
    console.info(`[seed:admin] created ${email} as owner`);
  }
  process.exit(0);
} catch (error) {
  console.error("[seed:admin] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
