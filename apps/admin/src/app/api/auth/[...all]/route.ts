import { authRouteHandlers } from "@scandihaven/auth/next-handler";

/**
 * Better-Auth route handler (PRD §8.4 whitelist, FR-601/FR-801). Mounts the
 * admin sign-in flow — the admin app is session-gated, so without this route
 * no admin user can authenticate.
 */
export const { GET, POST } = authRouteHandlers;

export const dynamic = "force-dynamic";
