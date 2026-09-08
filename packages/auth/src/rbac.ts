/**
 * Single-source RBAC matrix (PRD §9.2, FR-8xx role gates).
 * Both apps and all Server Actions authorize through `can()` — never inline checks.
 * Server-side re-check is the control; client gating is UX only.
 */
export const ROLES = [
  "user",
  "readonly",
  "warehouse",
  "customer_service",
  "merchandiser",
  "admin",
  "owner",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "orders:view",
  "orders:refund_small", // ≤ €500 (PRD §9.2)
  "orders:refund_large",
  "orders:fulfill",
  "orders:cancel",
  "catalog:view",
  "catalog:edit",
  "catalog:publish",
  "inventory:adjust",
  "content:edit",
  "promotions:manage",
  "customers:view",
  "customers:gdpr",
  "settings:manage",
  "trade:review",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  user: [],
  readonly: ["orders:view", "catalog:view", "customers:view"],
  warehouse: ["orders:view", "orders:fulfill", "catalog:view", "inventory:adjust"],
  customer_service: [
    "orders:view",
    "orders:refund_small",
    "orders:cancel",
    "orders:fulfill",
    "catalog:view",
    "customers:view",
  ],
  merchandiser: [
    "orders:view",
    "catalog:view",
    "catalog:edit",
    "catalog:publish",
    "content:edit",
    "customers:view",
  ],
  admin: [
    "orders:view",
    "orders:refund_small",
    "orders:refund_large",
    "orders:cancel",
    "orders:fulfill",
    "catalog:view",
    "catalog:edit",
    "catalog:publish",
    "inventory:adjust",
    "content:edit",
    "promotions:manage",
    "customers:view",
    "customers:gdpr",
    "trade:review",
  ],
  owner: [
    "orders:view",
    "orders:refund_small",
    "orders:refund_large",
    "orders:cancel",
    "orders:fulfill",
    "catalog:view",
    "catalog:edit",
    "catalog:publish",
    "inventory:adjust",
    "content:edit",
    "promotions:manage",
    "customers:view",
    "customers:gdpr",
    "settings:manage",
    "trade:review",
  ],
};

export function isRole(value: string | null | undefined): value is Role {
  return (ROLES as readonly string[]).includes(value ?? "");
}

export function parseRoles(roleField: string | null | undefined): Role[] {
  if (!roleField) return ["user"];
  return roleField
    .split(",")
    .map((r) => r.trim())
    .filter(isRole);
}

export function can(role: Role | Role[], permission: Permission): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((r) => MATRIX[r].includes(permission));
}

export function canAny(roles: Role[], permissions: Permission[]): boolean {
  return permissions.some((p) => can(roles, p));
}
