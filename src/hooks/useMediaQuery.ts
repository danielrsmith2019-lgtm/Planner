"use client";

import { useSyncExternalStore } from "react";

/**
 * True when the media query matches. Renders as `false` on the server and on
 * the first client pass (mobile first), then updates without a hydration error.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The app's desktop breakpoint (Tailwind sm, where the sidebar appears). */
export const DESKTOP_QUERY = "(min-width: 640px)";
