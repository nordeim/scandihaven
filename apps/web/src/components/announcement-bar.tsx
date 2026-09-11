"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { isDismissed, useAnnouncementStore } from "@/stores/announcement-store";

/**
 * Announcement bar (PRD FR-108; live audit round 8, R8-7): dismissible, with
 * the dismissal persisted under the announcement id (FR-108 prescribes
 * Zustand persist). Visibility derives from the persisted store through
 * useSyncExternalStore — the server snapshot (empty list) always renders the
 * bar, the client snapshot takes over after hydration with no mismatch
 * (same idiom as the PDP ?variant= deep link, audit 2026-09-09 M-3).
 */
export function AnnouncementBar({
  id,
  message,
  href,
}: {
  id: string;
  message: string;
  href: string | null;
}) {
  const dismissedIds = useSyncExternalStore(
    useAnnouncementStore.subscribe,
    () => useAnnouncementStore.getState().dismissedIds,
    () => [],
  );
  const visible = !isDismissed(dismissedIds, id);

  if (!visible) return null;

  return (
    <div className="relative bg-dark px-8 py-2 text-center text-xs text-bg">
      {href ? (
        <Link href={href} className="hover:underline">
          {message}
        </Link>
      ) : (
        message
      )}
      <button
        type="button"
        onClick={() => useAnnouncementStore.getState().dismiss(id)}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-pill px-2 py-1 text-bg/70 transition-colors hover:text-bg"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
