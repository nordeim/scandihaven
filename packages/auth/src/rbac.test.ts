import { describe, expect, it } from "vitest";
import { can, canAny, parseRoles, type Permission } from "./rbac";

describe("RBAC matrix (PRD §9.2)", () => {
  it("grants warehouse fulfillment but not refunds", () => {
    expect(can("warehouse", "orders:fulfill")).toBe(true);
    expect(can("warehouse", "orders:refund_small")).toBe(false);
  });

  it("grants customer service small refunds but not large", () => {
    expect(can("customer_service", "orders:refund_small")).toBe(true);
    expect(can("customer_service", "orders:refund_large")).toBe(false);
  });

  it("grants admin everything except settings", () => {
    expect(can("admin", "orders:refund_large")).toBe(true);
    expect(can("admin", "settings:manage")).toBe(false);
  });

  it("reserves settings for owner only", () => {
    expect(can("owner", "settings:manage")).toBe(true);
    for (const role of ["user", "readonly", "warehouse", "customer_service", "merchandiser", "admin"] as const) {
      expect(can(role, "settings:manage")).toBe(false);
    }
  });

  it("grants nothing to plain users", () => {
    for (const permission of [
      "orders:view",
      "catalog:edit",
      "inventory:adjust",
      "customers:gdpr",
    ] as const satisfies readonly Permission[]) {
      expect(can("user", permission)).toBe(false);
    }
  });

  it("handles multi-role sessions", () => {
    expect(canAny(["warehouse", "customer_service"], ["orders:refund_small"])).toBe(true);
    expect(canAny(["readonly", "merchandiser"], ["inventory:adjust"])).toBe(false);
  });

  it("parses role CSV fields defensively", () => {
    expect(parseRoles("owner,admin")).toEqual(["owner", "admin"]);
    expect(parseRoles("bogus")).toEqual([]);
    expect(parseRoles(null)).toEqual(["user"]);
    expect(parseRoles("")).toEqual(["user"]);
  });
});
