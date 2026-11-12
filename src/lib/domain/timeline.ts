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
