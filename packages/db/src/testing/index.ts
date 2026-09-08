/**
 * Typed test fixtures (PRD §12.5). Builders produce valid entity graphs with
 * deterministic IDs. Extend as commerce tests need them.
 */
export const TEST_IDS = {
  productId: "20000000-0000-4000-8000-000000000001",
  variantId: "20000000-0000-4000-8000-000000000002",
  cartId: "20000000-0000-4000-8000-000000000003",
  userId: "20000000-0000-4000-8000-000000000004",
} as const;

export type CartInput = {
  currency: string;
  lines: Array<{ qty: number; unitPriceMinor: number }>;
};

export function aCart(overrides: Partial<CartInput> = {}): CartInput {
  return {
    currency: "EUR",
    lines: [{ qty: 1, unitPriceMinor: 129_900 }],
    ...overrides,
  };
}
