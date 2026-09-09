import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the cart Server Action identity seam (PRD FR-403,
 * live E2E audit 2026-09-09 round 2, finding H1-CART).
 *
 * `getCartId()` resolves the signed cookie token to the cart row's UUID.
 * Commerce service functions key on that UUID. The action wiring must pass
 * the resolved UUID straight through — it must NEVER feed it back into
 * `ensureCart()`, which keys on the cart TOKEN and would silently mint a
 * junk cart row (symptom on the live site: "Cart line not found" on every
 * quantity change, remove that resurrects on reload, second add-to-cart
 * silently lost).
 */

const CART_UUID = "0f0e7d9a-6c1c-4a5e-9e5a-1f2b3c4d5e6f";
const JUNK_ID = "junk-cart-from-token-lookup-miss";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/cart-session", () => ({
  getCartId: vi.fn(),
}));

vi.mock("@scandihaven/commerce/cart-service", () => {
  return {
    CART_COOKIE_NAME: "sh_cart",
    CartError: class CartError extends Error {
      constructor(
        message: string,
        public readonly code: "NOT_FOUND" | "VALIDATION" | "NOT_PURCHASABLE",
      ) {
        super(message);
      }
    },
    createCartToken: vi.fn(() => "minted-token.sig"),
    ensureCart: vi.fn(() => JUNK_ID),
    addLine: vi.fn(),
    updateLineQty: vi.fn(),
    removeLine: vi.fn(),
    applyPromotionByCode: vi.fn(),
    getCartDto: vi.fn(),
  };
});

import { cookies } from "next/headers";
import {
  addLine,
  applyPromotionByCode,
  createCartToken,
  ensureCart,
  removeLine,
  updateLineQty,
} from "@scandihaven/commerce/cart-service";
import { getCartId } from "@/lib/cart-session";
import {
  addToCartAction,
  applyPromotionAction,
  removeLineAction,
  updateQtyAction,
} from "./cart";

const mockedGetCartId = vi.mocked(getCartId);
const mockedEnsureCart = vi.mocked(ensureCart);
const mockedUpdateLineQty = vi.mocked(updateLineQty);
const mockedRemoveLine = vi.mocked(removeLine);
const mockedAddLine = vi.mocked(addLine);
const mockedApplyPromo = vi.mocked(applyPromotionByCode);
const mockedCreateToken = vi.mocked(createCartToken);

const VARIANT_ID = "7b6c9a1e-2f3d-4a5b-8c9d-0e1f2a3b4c5d";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: the service functions echo back a healthy cart DTO shape.
  mockedUpdateLineQty.mockResolvedValue({ lines: [] } as never);
  mockedRemoveLine.mockResolvedValue({ lines: [] } as never);
  mockedAddLine.mockResolvedValue({ lines: [] } as never);
  mockedApplyPromo.mockResolvedValue({ lines: [] } as never);
});

describe("cart Server Actions — cart identity wiring (H1-CART regression)", () => {
  it("updateQtyAction passes the resolved cart UUID straight to updateLineQty", async () => {
    mockedGetCartId.mockResolvedValue(CART_UUID);

    await updateQtyAction({ lineId: VARIANT_ID, qty: 2 });

    expect(mockedUpdateLineQty).toHaveBeenCalledWith(CART_UUID, VARIANT_ID, 2);
    expect(mockedUpdateLineQty.mock.calls[0]?.[0]).toBe(CART_UUID);
  });

  it("updateQtyAction never re-resolves an existing cart through ensureCart", async () => {
    mockedGetCartId.mockResolvedValue(CART_UUID);

    await updateQtyAction({ lineId: VARIANT_ID, qty: 2 });

    expect(mockedEnsureCart).not.toHaveBeenCalledWith(CART_UUID);
    expect(mockedEnsureCart).not.toHaveBeenCalled();
  });

  it("removeLineAction passes the resolved cart UUID straight to removeLine", async () => {
    mockedGetCartId.mockResolvedValue(CART_UUID);

    await removeLineAction({ lineId: VARIANT_ID });

    expect(mockedRemoveLine).toHaveBeenCalledWith(CART_UUID, VARIANT_ID);
  });

  it("applyPromotionAction passes the resolved cart UUID straight to applyPromotionByCode", async () => {
    mockedGetCartId.mockResolvedValue(CART_UUID);

    await applyPromotionAction({ code: "welcome100" });

    expect(mockedApplyPromo).toHaveBeenCalledWith(CART_UUID, "welcome100");
  });

  it("addToCartAction keys the new line on the resolved cart UUID", async () => {
    mockedGetCartId.mockResolvedValue(CART_UUID);

    await addToCartAction({ variantId: VARIANT_ID, qty: 1, requestId: "req-12345678" });

    expect(mockedAddLine).toHaveBeenCalledWith(CART_UUID, VARIANT_ID, 1, "req-12345678");
  });

  it("addToCartAction with no existing cart mints a token and keys ensureCart on the token", async () => {
    mockedGetCartId.mockResolvedValue(null);

    await addToCartAction({ variantId: VARIANT_ID, qty: 1, requestId: "req-12345678" });

    expect(mockedCreateToken).toHaveBeenCalledTimes(1);
    const store = await cookies();
    expect(store.set).toHaveBeenCalledWith(
      "sh_cart",
      "minted-token.sig",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(mockedEnsureCart).toHaveBeenCalledWith("minted-token.sig");
    expect(mockedAddLine).toHaveBeenCalledWith(JUNK_ID, VARIANT_ID, 1, "req-12345678");
  });

  it("updateQtyAction rejects a non-uuid line id without touching the service", async () => {
    mockedGetCartId.mockResolvedValue(CART_UUID);

    const result = await updateQtyAction({ lineId: "not-a-uuid", qty: 2 });

    expect(result.ok).toBe(false);
    expect(mockedUpdateLineQty).not.toHaveBeenCalled();
  });
});
