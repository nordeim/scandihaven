import { notFound } from "next/navigation";

/**
 * /lookbooks/* catch-all (PRD FR-705). Lookbooks are a Phase 5 surface; the
 * route must exist so unmatched /lookbooks URLs resolve here and throw a
 * server-rendered honest 404 naming the FR ID (§15.3) instead of falling
 * through to the generic root not-found.
 */
export default function LookbooksPage() {
  notFound();
}
