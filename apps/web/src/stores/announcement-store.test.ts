import { beforeEach, describe, expect, it } from "vitest";
import { isDismissed, useAnnouncementStore } from "./announcement-store";

/**
 * Announcement dismissal (PRD FR-108; live audit round 8, R8-7): the bar is
 * dismissible and the dismissal persists (Zustand persist) keyed on the
 * announcement id — a NEW announcement id re-shows the bar, so rotating the
 * content re-engages customers instead of a permanently dismissed bar.
 */
describe("announcement store (R8-7, FR-108)", () => {
  beforeEach(() => {
    useAnnouncementStore.setState({ dismissedIds: [] });
  });

  it("dismiss records the announcement id", () => {
    useAnnouncementStore.getState().dismiss("ann-1");
    expect(useAnnouncementStore.getState().dismissedIds).toContain("ann-1");
  });

  it("dismissal is id-scoped: other announcements stay visible", () => {
    useAnnouncementStore.getState().dismiss("ann-1");
    expect(isDismissed(["ann-1"], "ann-1")).toBe(true);
    expect(isDismissed(["ann-1"], "ann-2")).toBe(false);
  });

  it("dismissing the same announcement twice does not duplicate the id", () => {
    useAnnouncementStore.getState().dismiss("ann-1");
    useAnnouncementStore.getState().dismiss("ann-1");
    expect(useAnnouncementStore.getState().dismissedIds).toEqual(["ann-1"]);
  });
});
