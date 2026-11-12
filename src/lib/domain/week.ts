import { addDays, toDayNumber, type LocalDate } from "./dates";

/**
 * Week helpers. Weeks run Monday to Sunday. Day number 0 (1970-01-01) was a
 * Thursday, so (dayNumber + 3) % 7 is 0 on Mondays.
 */

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(date: LocalDate): number {
  return (((toDayNumber(date) + 3) % 7) + 7) % 7;
}

/** The Monday on or before `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekdayIndex(date));
}

/** The 7 dates of the week starting at `start`. */
export function weekDates(start: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const parts = (date: LocalDate) => {
  const [y, m, d] = date.split("-").map(Number);
  return { year: y ?? 0, month: (m ?? 1) - 1, day: d ?? 1 };
};

/** { weekday: "MON", day: 3 }, for "MON 3" headers. */
export function dayHeader(date: LocalDate): { weekday: string; day: number } {
  return { weekday: WEEKDAYS[weekdayIndex(date)] ?? "", day: parts(date).day };
}

/** "Nov 9 - 15", "Nov 30 - Dec 6", "Dec 28, 2026 - Jan 3, 2027". */
export function formatWeekLabel(start: LocalDate): string {
  const a = parts(start);
  const b = parts(addDays(start, 6));
  if (a.year !== b.year) {
    return `${MONTHS[a.month]} ${a.day}, ${a.year} - ${MONTHS[b.month]} ${b.day}, ${b.year}`;
  }
  if (a.month !== b.month) return `${MONTHS[a.month]} ${a.day} - ${MONTHS[b.month]} ${b.day}`;
  return `${MONTHS[a.month]} ${a.day} - ${b.day}`;
}
