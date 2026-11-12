import { createElement } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  Minus,
  NotebookPen,
  Plus,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * The only file in the app that imports lucide-react.
 * Components use <Icon icon="planner" /> or import a named icon from here.
 */
export const ICONS = {
  planner: CalendarClock,
  journal: NotebookPen,
  goals: Target,
  add: Plus,
  week: CalendarDays,
  settings: Settings,
  complete: Check,
  reschedule: CalendarClock,
  stalled: AlertTriangle,
  ahead: TrendingUp,
  behind: TrendingDown,
  flat: Minus,
  mail: Mail,
  signOut: LogOut,
  previous: ChevronLeft,
  next: ChevronRight,
  close: X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export type { LucideIcon };

type IconProps = Omit<LucideProps, "ref"> & {
  /** A key from ICONS, or any LucideIcon component re-exported from this file. */
  icon: IconName | LucideIcon;
};

/**
 * Lucide icons are forwardRef objects, not plain functions, so we tell a
 * component apart from a name with typeof icon !== "string".
 */
export function resolveIcon(icon: IconName | LucideIcon): LucideIcon {
  return typeof icon !== "string" ? icon : ICONS[icon];
}

export function Icon({
  icon,
  size = 20,
  strokeWidth = 2,
  "aria-label": ariaLabel,
  ...rest
}: IconProps) {
  // createElement, not <Component />: the icon is chosen at render time, and
  // react-hooks/static-components rejects JSX for components picked during render.
  return createElement(resolveIcon(icon), {
    size,
    strokeWidth,
    "aria-label": ariaLabel,
    "aria-hidden": ariaLabel ? undefined : true,
    ...rest,
  });
}

export {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  Minus,
  NotebookPen,
  Plus,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  X,
};
