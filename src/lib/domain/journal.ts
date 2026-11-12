import { addDays, type LocalDate } from "./dates";
import { startOfWeek } from "./week";

/**
 * Journal display rules: moods (1-5, shown with icons, never emoji) and the
 * month calendar grid. Pure; used by the editor, the calendar and the server.
 */

export type MoodValue = 1 | 2 | 3 | 4 | 5;

export const MOODS = [
  { value: 1, label: "Rough", icon: "moodRough", color: "var(--color-bc-red)" },
  { value: 2, label: "Meh", icon: "moodMeh", color: "var(--color-bc-orange)" },
  { value: 3, label: "Okay", icon: "moodOkay", color: "var(--color-bc-teal)" },
  { value: 4, label: "Good", icon: "moodGood", color: "var(--color-bc-green)" },
  { value: 5, label: "Great", icon: "moodGreat", color: "var(--color-bc-purple)" },
] as const;

export type Mood = (typeof MOODS)[number];

export function moodFor(value: number | null): Mood | null {
  return MOODS.find((m) => m.value === value) ?? null;
}

/** An empty Tiptap document, for a day with no entry yet. */
export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] } as const;

/** "2026-11" for a date. */
export function monthOf(date: LocalDate): string {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = (y ?? 0) * 12 + ((m ?? 1) - 1) + by;
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "November 2026". */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

export function monthBounds(month: string): { first: LocalDate; last: LocalDate } {
  const first = `${month}-01`;
  return { first, last: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}

/**
 * The calendar's weeks, Monday first: whole weeks covering the month, with
 * days from the neighbouring months marked inMonth: false.
 */
export function monthGrid(month: string): { date: LocalDate; inMonth: boolean }[][] {
  const { first, last } = monthBounds(month);
  const weeks: { date: LocalDate; inMonth: boolean }[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= last) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(cursor, i);
      return { date, inMonth: monthOf(date) === month };
    });
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
