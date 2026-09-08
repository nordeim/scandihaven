import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@scandihaven/auth/server";
import { can, parseRoles, type Permission } from "@scandihaven/auth/rbac";
import { InvalidOrderTransition } from "@scandihaven/commerce/order-state";
import type { ErrorCode } from "@scandihaven/commerce/result";
import { db } from "@scandihaven/db/client";
import { auditLog } from "@scandihaven/db/schema";

/**
 * Thrown when an authenticated session lacks the permission (PRD §9.2).
 * Actions catch this and map it to the FORBIDDEN ActionResult — authorization
 * failures must never throw across the action boundary (§8.2/§15.1).
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Domain-level action failures that map 1:1 onto the §8.2 ErrorCode union
 * (NOT_FOUND for a missing row, CONFLICT for a stale optimistic write).
 */
export class OrderActionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "OrderActionError";
  }
}

/**
 * Map a caught error onto the ActionResult error envelope. Returns null for
 * unexpected errors — the caller logs those and returns INTERNAL (§4.5:
 * internals never reach the client).
 */
export function toActionError(error: unknown): { code: ErrorCode; message: string } | null {
  if (error instanceof ForbiddenError) return { code: "FORBIDDEN", message: error.message };
  if (error instanceof OrderActionError) return { code: error.code, message: error.message };
  if (error instanceof InvalidOrderTransition) {
    return { code: "INVALID_TRANSITION", message: error.message };
  }
  return null;
}

/**
 * Server-side authorization + audit (PRD §9.2/FR-8xx preamble):
 * the single gate every admin action must pass before touching the domain.
 */
export async function requirePermission(permission: Permission): Promise<{
  userId: string;
  role: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) redirect("/sign-in");

  const roles = parseRoles(session.user.role);
  if (!can(roles, permission)) {
    throw new ForbiddenError(`Role ${roles.join(",") || "user"} lacks ${permission}`);
  }
  return { userId: session.user.id, role: roles.join(",") };
}

export async function writeAudit(input: {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await db.insert(auditLog).values({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: (input.before ?? null) as never,
    after: (input.after ?? null) as never,
  });
}
