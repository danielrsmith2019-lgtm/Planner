import type { IconName } from "@/utils/icons";

/**
 * Navigation and header rules for the app shell. Plain module (no
 * 'use client'), so Server and Client Components can both import it.
 */

export type NavItem = { href: string; label: string; icon: IconName };

/** Sidebar and icon rail, in order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today", icon: "planner" },
  { href: "/week", label: "Week", icon: "week" },
  { href: "/journal", label: "Journal", icon: "journal" },
  { href: "/goals", label: "Goals", icon: "goals" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Bottom tabs on phones; the raised Quick add button sits between Week and Journal. */
export const TAB_ITEMS_LEFT: readonly NavItem[] = NAV_ITEMS.slice(0, 2);
export const TAB_ITEMS_RIGHT: readonly NavItem[] = NAV_ITEMS.slice(2, 4);

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type HeaderConfig = {
  title: string;
  /** Show the "< Wed, Nov 4 >" navigator. */
  dateNav: boolean;
  /** Days moved by the arrows (7 on the week view). */
  dateStep: number;
  /** Show the Plan | Do | Reflect chip. */
  modeChip: boolean;
};

const HEADERS: Record<string, HeaderConfig> = {
  "/today": { title: "Today", dateNav: true, dateStep: 1, modeChip: true },
  "/week": { title: "Week", dateNav: true, dateStep: 7, modeChip: false },
  "/journal": { title: "Journal", dateNav: true, dateStep: 1, modeChip: false },
  "/goals": { title: "Goals", dateNav: false, dateStep: 1, modeChip: false },
  "/settings": { title: "Settings", dateNav: false, dateStep: 1, modeChip: false },
};

export function getHeaderConfig(pathname: string): HeaderConfig {
  const match = Object.keys(HEADERS).find((href) => isActivePath(pathname, href));
  return match ? HEADERS[match] : { title: "Planner", dateNav: false, dateStep: 1, modeChip: false };
}
