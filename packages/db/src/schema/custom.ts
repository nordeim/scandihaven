/** Custom column types (drizzle pg-core has no built-in citext). */
import { customType } from "drizzle-orm/pg-core";

/**
 * Case-insensitive text (uses the citext extension, created in migration 0000
 * and in ensureSeeded before any conflict-dependent insert).
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

/**
 * tsvector for the maintained product search vector (round 7, R-DB-1; PRD
 * §8.8). Stored as an opaque string at the driver level — the column is
 * GENERATED ALWAYS by Postgres, so no client ever writes it.
 */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});
