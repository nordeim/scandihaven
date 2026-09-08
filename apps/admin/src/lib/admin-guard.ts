import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@scandihaven/auth/server";
import { can, parseRoles, type Permission } from "@scandihaven/auth/rbac";
import { db } from "@scandihaven/db/client";
import { auditLog } from "@scandihaven/db/schema";

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
    throw new Error(`Forbidden: role ${roles.join(",") || "user"} lacks ${permission}`);
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
