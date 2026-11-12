import { blockEnd } from "./layout";

/**
 * Tap-to-schedule (blueprint Section 4, "Touch interactions"): find the first
 * free slot of a given length. Busy time is every time-blocked task that
 * isn't skipped (done tasks still held their slot). Starts are on quarter
 * hours.
 */

export type SlotTask = { id: string; startMin: number | null; durationMin: number | null; status?: "TODO" | "DONE" | "SKIPPED" };

const QUARTER = 15;

export const MORNING_START_MIN = 8 * 60;
export const AFTERNOON_START_MIN = 13 * 60;
export const EVENING_START_MIN = 18 * 60;
export const DAY_END_MIN = 24 * 60;

/** Round up to the next quarter hour (9:07 -> 9:15; 9:15 stays). */
export function ceilToQuarter(minute: number): number {
  return Math.ceil(minute / QUARTER) * QUARTER;
}

/**
 * The earliest quarter-hour start at or after fromMin where durationMin fits
 * without overlapping a busy block and ends by dayEndMin; null when none does.
 * Pass excludeId to ignore the task being rescheduled.
 */
export function findNextFreeSlot(
  tasks: readonly SlotTask[],
  durationMin: number,
  fromMin: number,
  dayEndMin: number = DAY_END_MIN,
  excludeId?: string,
): number | null {
  if (durationMin <= 0) return null;
  const busy = tasks
    .filter((t): t is SlotTask & { startMin: number } => t.startMin !== null && t.status !== "SKIPPED" && t.id !== excludeId)
    .map((t) => ({ start: t.startMin, end: blockEnd(t) }))
    .sort((a, b) => a.start - b.start);

  let candidate = ceilToQuarter(Math.max(0, fromMin));
  for (const block of busy) {
    if (block.end <= candidate) continue;
    if (candidate + durationMin <= block.start) break;
    // Overlaps: try right after this block.
    candidate = Math.max(candidate, ceilToQuarter(block.end));
  }
  return candidate + durationMin <= dayEndMin ? candidate : null;
}
