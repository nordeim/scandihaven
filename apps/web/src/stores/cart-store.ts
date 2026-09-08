import { create } from "zustand";
import type { CartDto } from "@scandihaven/commerce/dto";

/**
 * Cart UI store (PRD §10.4): drawer visibility + optimistic pending lines.
 * Server data is never copied here — RSC props are the source of truth;
 * only the drawer open flag and last-error live client-side.
 */
type CartStore = {
  drawerOpen: boolean;
  lastError: string | null;
  open: () => void;
  close: () => void;
  setError: (message: string | null) => void;
};

export const useCartStore = create<CartStore>((set) => ({
  drawerOpen: false,
  lastError: null,
  open: () => set({ drawerOpen: true }),
  close: () => set({ drawerOpen: false }),
  setError: (message) => set({ lastError: message }),
}));

export type { CartDto };
