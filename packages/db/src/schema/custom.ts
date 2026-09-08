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
