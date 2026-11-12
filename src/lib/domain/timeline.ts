import { blockEnd, type TimedBlock } from "./layout";

/**
 * The visible hours of the day timeline: 6 AM to 11 PM by default, widened to
 * whole hours that fit every block (and the now-line, when shown).
 */
export const DEFAULT_START_HOUR = 6;
export const DEFAULT_END_HOUR = 23;

export function timelineRange(blocks: readonly TimedBlock[], nowMin: number | null = null): { startHour: number; endHour: number } {
  let start = DEFAULT_START_HOUR * 60;
  let end = DEFAULT_END_HOUR * 60;
  for (const block of blocks) {
    start = Math.min(start, block.startMin);
    end = Math.max(end, blockEnd(block));
  }
  if (nowMin !== null) {
    start = Math.min(start, nowMin);
    end = Math.max(end, nowMin + 1);
  }
  return { startHour: Math.max(0, Math.floor(start / 60)), endHour: Math.min(24, Math.ceil(end / 60)) };
}

/** "6 AM", "12 PM", "11 PM". */
export function hourLabel(hour: number): string {
  const h = hour % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

/** Drag snapping: every drop lands on a quarter hour. */
export const SNAP_MIN = 15;
export const MIN_DURATION_MIN = 15;

/**
 * Start time for a drop at yPx below the top of the timeline grid:
 * Math.round((y / pxPerMin) / 15) * 15 from the first visible hour, clamped
 * so the whole block stays inside the visible hours.
 */
export function snapStartMin(yPx: number, pxPerMin: number, startHour: number, endHour: number, durationMin: number): number {
  const raw = Math.round(yPx / pxPerMin / SNAP_MIN) * SNAP_MIN + startHour * 60;
  const latest = endHour * 60 - Math.max(durationMin, SNAP_MIN);
  return Math.min(Math.max(raw, startHour * 60), Math.max(latest, startHour * 60));
}

/**
 * New duration when the resize handle is dropped at yPx: the snapped end time
 * minus the start, at least 15 minutes, never past the last visible hour.
 */
export function snapDuration(startMin: number, yPx: number, pxPerMin: number, startHour: number, endHour: number): number {
  const end = Math.round(yPx / pxPerMin / SNAP_MIN) * SNAP_MIN + startHour * 60;
  const clampedEnd = Math.min(Math.max(end, startMin + MIN_DURATION_MIN), endHour * 60);
  return Math.max(clampedEnd - startMin, MIN_DURATION_MIN);
}

/** "7:30-8:15", "11:45-12:30", for the drop preview. */
export function formatSpan(startMin: number, endMin: number): string {
  const clock = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const mm = m % 60;
    return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")}`;
  };
  return `${clock(startMin)}-${clock(endMin)}`;
}
