import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "./server";

/**
 * App Router adapter for the §8.4 route-whitelist entry `/api/auth/[...all]`.
 * Both apps mount this via `export const { GET, POST } = authRouteHandlers`.
 * better-auth never leaves this package (vendor-adapter discipline, §4.8).
 */
export const authRouteHandlers = toNextJsHandler(auth.handler);
