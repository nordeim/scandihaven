import { describe, it, expect } from "vitest";
import { isSignInPath } from "./sign-in-paths";

/**
 * Live E2E audit 2026-09-09 round 2 (H2-ADMIN): the deployment serves the
 * admin app behind host-based routing where the canonical URL carries an
 * `/admin` path prefix (https://scandihaven-admin.jesspete.shop/admin). The
 * app has no `/admin` routes, so the gate must let the prefixed sign-in page
 * through exactly like `/sign-in`, and next.config rewrites strip the prefix
 * for everything else. These tests pin that contract.
 */
describe("isSignInPath", () => {
  it("lets the bare sign-in route through", () => {
    expect(isSignInPath("/sign-in")).toBe(true);
  });

  it("lets the /admin-prefixed sign-in route through", () => {
    expect(isSignInPath("/admin/sign-in")).toBe(true);
  });

  it("does not let gated surfaces through", () => {
    expect(isSignInPath("/")).toBe(false);
    expect(isSignInPath("/products")).toBe(false);
    expect(isSignInPath("/orders")).toBe(false);
    expect(isSignInPath("/admin")).toBe(false);
    expect(isSignInPath("/admin/products")).toBe(false);
  });

  it("does not match by prefix alone", () => {
    expect(isSignInPath("/sign-in/anything")).toBe(false);
    expect(isSignInPath("/admin/sign-in/anything")).toBe(false);
    expect(isSignInPath("/admin/sign-in-extra")).toBe(false);
  });
});
