import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  cartLine,
  order,
  orderLine,
  variantPrice,
  inventoryLevel,
  webhookEvent,
  job,
  user,
  product,
  productVariant,
  category,
  collection,
  review,
  cart,
  promotion,
  fxRate,
  shippingRate,
  returnRequest,
} from "./schema";

/**
 * Schema-shape smoke (PRD §7): guards the contract columns the domain relies on.
 * Pure TypeScript — no database required. Imports ./schema (not ./index) so
 * the suite stays hermetic: ./index re-exports the pooled client, which
 * asserts DATABASE_URL at import and would break env-less unit CI.
 */
function indexColumns(table: Parameters<typeof getTableConfig>[0]): Array<{ name: string; unique: boolean; composite: boolean }> {
  const { indexes, primaryKeys } = getTableConfig(table);
  const result: Array<{ name: string; unique: boolean; composite: boolean }> = [];
  for (const index of indexes) {
    for (const col of index.config.columns) {
      const name = "name" in col && typeof col.name === "string" ? col.name : "";
      result.push({ name, unique: Boolean(index.config.unique), composite: index.config.columns.length > 1 });
    }
  }
  // Composite primary keys surface via primaryKeys, not per-column flags.
  for (const pk of primaryKeys) {
    for (const col of pk.columns) {
      const name = "name" in col && typeof col.name === "string" ? col.name : "";
      result.push({ name, unique: true, composite: pk.columns.length > 1 });
    }
  }
  return result;
}

describe("drizzle schema shape (PRD §7)", () => {
  it("money columns are integer minor units; rates stay numeric (ADR-7)", () => {
    for (const table of [variantPrice, order, orderLine]) {
      const columns = getTableColumns(table);
      for (const [column, def] of Object.entries(columns)) {
        if (column === "taxRate" || column === "fxRate") {
          // Rates are ratios, not money — numeric by design.
          expect(def.columnType).toBe("PgNumeric");
        } else if (/(amount|price|total|subtotal|discount|shipping|tax)/.test(column)) {
          expect(def.columnType).toBe("PgInteger");
        }
      }
    }
  });

  it("order exposes the PRD §7.4 money + identity columns", () => {
    const columns = getTableColumns(order);
    for (const column of ["subtotal", "discount", "shipping", "tax", "total", "totalEur"]) {
      expect(column in columns).toBe(true);
    }
    expect(indexColumns(order).some((c) => c.name === "number" && c.unique)).toBe(true);
  });

  it("cart line is unique per (cart, variant, gift-wrap) (FR-403)", () => {
    expect(indexColumns(cartLine).some((c) => c.composite && c.unique)).toBe(true);
  });

  it("inventory levels are keyed by (variant, warehouse) (PRD §7.6)", () => {
    const keys = indexColumns(inventoryLevel).filter((c) => c.unique && c.composite);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("webhook events are unique by stripe event id (idempotency, §8.4)", () => {
    expect(indexColumns(webhookEvent).some((c) => c.name === "stripe_event_id" && c.unique)).toBe(true);
  });

  it("jobs carry a unique idempotency key (outbox, §4.3)", () => {
    expect(indexColumns(job).some((c) => c.name === "idempotency_key" && c.unique)).toBe(true);
  });

  it("user table carries trade + role extensions (PRD §7.5)", () => {
    const columns = getTableColumns(user);
    for (const column of ["role", "tradeStatus", "tradeTier", "paymentTerms", "marketingOptIn"]) {
      expect(column in columns).toBe(true);
    }
  });

  it("catalog graph tables exist", () => {
    const tables = [
      product,
      productVariant,
      variantPrice,
      category,
      collection,
      review,
      cart,
      promotion,
      fxRate,
      shippingRate,
      returnRequest,
    ];
    for (const table of tables) {
      expect(Object.keys(getTableColumns(table)).length).toBeGreaterThan(2);
    }
  });
});
