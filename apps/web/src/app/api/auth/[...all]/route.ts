import { authRouteHandlers } from "@scandihaven/auth/next-handler";

/**
 * Better-Auth route handler (PRD §8.4 whitelist, FR-601). Mounts sign-in /
 * sign-up / session / OAuth flows for the authClient used by the sign-in
 * pages — without this route every authClient call 404s.
 */
export const { GET, POST } = authRouteHandlers;

export const dynamic = "force-dynamic";
