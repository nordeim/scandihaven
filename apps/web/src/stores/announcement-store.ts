import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Announcement dismissal (PRD FR-108; live audit round 8, R8-7): the bar is
 * dismissible and the dismissal persists (FR-108 prescribes Zustand persist)
 * keyed on the announcement id — a NEW announcement re-shows the bar.
 */
type AnnouncementStore = {
  dismissedIds: string[];
  dismiss: (id: string) => void;
};

export const useAnnouncementStore = create<AnnouncementStore>()(
  persist(
    (set) => ({
      dismissedIds: [],
      dismiss: (id) =>
        set((state) => ({
          dismissedIds: state.dismissedIds.includes(id)
            ? state.dismissedIds
            : [...state.dismissedIds, id],
        })),
    }),
    {
      name: "sh-announcement-dismissed",
      storage: createJSONStorage(() => localStorage),
      // Only the dismissal list persists; future store fields (if any) stay
      // session-local by default.
      partialize: (state) => ({ dismissedIds: state.dismissedIds }),
    },
  ),
);

/** Pure visibility check: SSR-safe (an empty list renders the bar). */
export function isDismissed(dismissedIds: string[], id: string): boolean {
  return dismissedIds.includes(id);
}
