import { formatInTimeZone } from "date-fns-tz";

/**
 * Local calendar dates and minutes-of-day.
 *
 * A day is a "YYYY-MM-DD" string (LocalDate). getLocalToday is the ONLY place
 * the app decides what "today" is. Callers pass the clock in (`now`), so this
 * module stays pure and testable.
 */

export type LocalDate = string;
export type ClockFormat = "12h" | "24h";

export type DayBoundaryUser = {
  /** IANA zone, e.g. "America/New_York" */
  timezone: string;
  /** Minutes after local midnight when the user's day starts (240 = 4:00am). */
  dayStartsAt: number;
};

const MS_PER_DAY = 86_400_000;
const MINUTES_PER_DAY = 1440;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole days since 1970-01-01 for a calendar date (UTC math, no DST shifts). */
export function toDayNumber(date: LocalDate): number {
  const match = LOCAL_DATE.exec(date);
  if (!match) throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`"${date}" is not a real calendar date`);
  }
  return ms / MS_PER_DAY;
}

function fromDayNumber(dayNumber: number): LocalDate {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Calendar-date arithmetic: addDays("2026-12-31", 1) === "2027-01-01". */
export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/**
 * The user's current calendar day.
 *
 * Reads the wall-clock date and time in the user's zone, then rolls back one
 * day if the time is before dayStartsAt. Working from wall-clock time (not by
 * shifting the instant) keeps DST weekends correct: 4:00am is the start of the
 * day whether the night was 23 or 25 hours long.
 */
export function getLocalToday(user: DayBoundaryUser, now: Date): LocalDate {
  const { timezone, dayStartsAt } = user;
  if (!Number.isInteger(dayStartsAt) || dayStartsAt < 0 || dayStartsAt >= MINUTES_PER_DAY) {
    throw new RangeError(`dayStartsAt must be a whole number from 0 to 1439, got ${dayStartsAt}`);
  }
  if (Number.isNaN(now.getTime())) throw new RangeError("now is an invalid Date");

  let wallClock: string;
  try {
    wallClock = formatInTimeZone(now, timezone, "yyyy-MM-dd HH:mm");
  } catch {
    throw new RangeError(`Unknown time zone "${timezone}"`);
  }

  const [date, time] = wallClock.split(" ");
  const [hours, minutes] = time.split(":").map(Number);
  const minuteOfDay = hours * 60 + minutes;

  return minuteOfDay < dayStartsAt ? addDays(date, -1) : date;
}

/** True for IANA zones this runtime knows, e.g. "America/New_York". */
export function isValidTimeZone(timezone: string): boolean {
  if (typeof timezone !== "string" || timezone.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** 450 -> "7:30 AM" (default) or "07:30" with "24h". */
export function minutesToLabel(startMin: number, clock: ClockFormat = "12h"): string {
  if (!Number.isInteger(startMin) || startMin < 0 || startMin >= MINUTES_PER_DAY) {
    throw new RangeError(`Minutes must be a whole number from 0 to 1439, got ${startMin}`);
  }
  const hours = Math.floor(startMin / 60);
  const minutes = String(startMin % 60).padStart(2, "0");

  if (clock === "24h") return `${String(hours).padStart(2, "0")}:${minutes}`;
  const suffix = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

const TIME_LABEL = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/;

/**
 * Parses "7:30 AM", "7:30am", "7am", "7 pm", "12am", "07:30", "19:05".
 * Returns minutes after midnight, or null for anything it can't read.
 * Without am/pm the label must be 24-hour "H:MM".
 */
export function labelToMinutes(label: string): number | null {
  const match = TIME_LABEL.exec(label.trim().toLowerCase());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const meridiem = match[3]?.replaceAll(".", "");
  if (minute > 59) return null;

  if (meridiem === undefined) {
    if (match[2] === undefined || hour > 23) return null;
    return hour * 60 + minute;
  }

  if (hour < 1 || hour > 12) return null;
  const hour24 = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  return hour24 * 60 + minute;
}
