import type { LocalDate } from "@/lib/domain/dates";

/** Every TanStack Query key in the app, in one place. */
export const queryKeys = {
  day: (date: LocalDate) => ["day", date] as const,
  /** startDate is the week's Monday. */
  week: (startDate: LocalDate) => ["week", startDate] as const,
  goals: () => ["goals"] as const,
  goal: (id: string) => ["goal", id] as const,
  /** Journal blocks mentioning a goal (its Reflections section). */
  goalReflections: (id: string) => ["goalReflections", id] as const,
  journal: (date: LocalDate) => ["journal", date] as const,
  /** month is "YYYY-MM". */
  journalMonth: (month: string) => ["journalMonth", month] as const,
  /** Unfinished tasks from before today (carry-over banner). */
  carryOver: () => ["carryOver"] as const,
};
