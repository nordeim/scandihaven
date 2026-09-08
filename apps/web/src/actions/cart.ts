"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CART_COOKIE_NAME,
  CartError,
  addLine,
  applyPromotionByCode,
  createCartToken,
  ensureCart,
  getCartDto,
  removeLine,
  updateLineQty,
} from "@scandihaven/commerce/cart-service";
import type { CartDto } from "@scandihaven/commerce/dto";
import { fail, ok, type ActionResult } from "@scandihaven/commerce/result";
import { getCartId } from "@/lib/cart-session";

/**
 * Cart Server Actions (PRD §8.3). Each action: parse → execute → revalidate →
 * return the typed result union. The cart cookie is set here (server boundary).
 */
async function requireCart(): Promise<string> {
  const existing = await getCartId();
  if (existing) return ensureCart(existing);
  const token = createCartToken();
  const store = await cookies();
  store.set(CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return ensureCart(token);
}

const lineInput = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
});

export async function addToCartAction(input: {
  variantId: string;
  qty: number;
}): Promise<ActionResult<CartDto>> {
  const parsed = lineInput.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", "Invalid cart input", { qty: ["Must be 1–99"] });
  }
  try {
    const cartId = await requireCart();
    const dto = await addLine(cartId, parsed.data.variantId, parsed.data.qty);
    revalidatePath("/", "layout");
    return ok(dto);
  } catch (error) {
    return cartErrorToResult(error);
  }
}

export async function updateQtyAction(input: {
  lineId: string;
  qty: number;
}): Promise<ActionResult<CartDto>> {
  const parsed = z
    .object({ lineId: z.string().uuid(), qty: z.number().int().min(0).max(99) })
    .safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Invalid quantity");
  try {
    const cartId = await requireCart();
    const dto = await updateLineQty(cartId, parsed.data.lineId, parsed.data.qty);
    revalidatePath("/", "layout");
    return ok(dto);
  } catch (error) {
    return cartErrorToResult(error);
  }
}

export async function removeLineAction(input: { lineId: string }): Promise<ActionResult<CartDto>> {
  const parsed = z.object({ lineId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Invalid line");
  try {
    const cartId = await requireCart();
    const dto = await removeLine(cartId, parsed.data.lineId);
    revalidatePath("/", "layout");
    return ok(dto);
  } catch (error) {
    return cartErrorToResult(error);
  }
}

export async function applyPromotionAction(input: {
  code: string;
}): Promise<ActionResult<CartDto>> {
  const parsed = z.object({ code: z.string().min(2).max(40) }).safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Enter a promotion code");
  try {
    const cartId = await requireCart();
    const dto = await applyPromotionByCode(cartId, parsed.data.code);
    revalidatePath("/cart");
    return ok(dto);
  } catch (error) {
    return cartErrorToResult(error);
  }
}

export async function getCartAction(): Promise<ActionResult<CartDto | null>> {
  try {
    const cartId = await getCartId();
    if (!cartId) return ok(null);
    return ok(await getCartDto(cartId));
  } catch (error) {
    return cartErrorToResult(error);
  }
}

function cartErrorToResult(error: unknown): ActionResult<never> {
  if (error instanceof CartError) {
    const code =
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "VALIDATION"
          ? "VALIDATION"
          : error.code === "NOT_PURCHASABLE"
            ? "CONFLICT"
            : "INTERNAL";
    return fail(code, error.message);
  }
  console.error("[cart action] unexpected error", error);
  return fail("INTERNAL", "Something went wrong. Please try again.");
}
