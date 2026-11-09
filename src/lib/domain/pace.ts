/**
 * Pace (blueprint Section 3): is a goal ahead of, on, or behind schedule?
 *
 *   expected = (today - start) / (target - start), clamped to 0..1
 *   ahead    if progress >= expected + 0.05
 *   behind   if progress <  expected - 0.10
 *   on_track otherwise; null when the goal has no target date
 *
 * Dates are local calendar days as "YYYY-MM-DD" strings. "today" is passed in
 * (from getLocalToday(user)); this module never reads the clock.
 */

import { toDayNumber, type LocalDate } from "./dates";

export type { LocalDate };
export type PaceStatus = "ahead" | "on_track" | "behind";

export const AHEAD_MARGIN = 0.05;
export const BEHIND_MARGIN = 0.1;

/** Absorbs floating-point error at the exact boundary values. */
const EPSILON = 1e-9;

export type ExpectedProgressInput = {
  startDate: LocalDate;
  targetDate: LocalDate | null;
  today: LocalDate;
};

export type PaceInput = ExpectedProgressInput & {
  /** 0..1 */
  progress: number;
};

/** Share of the goal's window that has elapsed, 0..1. Null without a target date. */
export function computeExpectedProgress({ startDate, targetDate, today }: ExpectedProgressInput): number | null {
  if (targetDate === null) return null;

  const start = toDayNumber(startDate);
  const target = toDayNumber(targetDate);
  const now = toDayNumber(today);

  const span = target - start;
  if (span <= 0) return now >= target ? 1 : 0;

  const expected = (now - start) / span;
  if (expected <= 0) return 0;
  return expected >= 1 ? 1 : expected;
}

export function computePace(input: PaceInput): PaceStatus | null {
  const expected = computeExpectedProgress(input);
  if (expected === null) return null;

  if (input.progress >= expected + AHEAD_MARGIN - EPSILON) return "ahead";
  if (input.progress < expected - BEHIND_MARGIN - EPSILON) return "behind";
  return "on_track";
}
