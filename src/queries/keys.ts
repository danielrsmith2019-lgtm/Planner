import type { LocalDate } from "@/lib/domain/dates";

/** Every TanStack Query key in the app, in one place. */
export const queryKeys = {
  day: (date: LocalDate) => ["day", date] as const,
  goals: () => ["goals"] as const,
  goal: (id: string) => ["goal", id] as const,
  journal: (date: LocalDate) => ["journal", date] as const,
  /** Unfinished tasks from before today (carry-over banner). */
  carryOver: () => ["carryOver"] as const,
};
