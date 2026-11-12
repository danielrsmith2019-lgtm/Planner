import type { DayTask } from "./goal-tree";

/**
 * How the Today list splits and orders a day's tasks (blueprint Section 4,
 * Today: Top 3, then the rest of the day, then the backlog).
 */

/** At most this many Top 3 tasks per day (enforced by the task services). */
export const MAX_TOP_THREE = 3;

export const TOP_THREE_FULL_MESSAGE =
  "That day already has 3 Top 3 tasks. Finish or unflag one, or add this as a regular task.";

/** By start time (untimed last), then rank. */
export function compareByStartThenRank(a: DayTask, b: DayTask): number {
  if (a.startMin !== b.startMin) {
    if (a.startMin === null) return 1;
    if (b.startMin === null) return -1;
    return a.startMin - b.startMin;
  }
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0;
}

export type DayLists = { topThree: DayTask[]; rest: DayTask[] };

/**
 * TOP 3: up to three isTopThree tasks (skipped ones hidden), in rank order.
 * TODAY: every other task except skipped ones, by startMin then rank.
 * If data ever holds more than three flagged tasks, the extras fall into TODAY.
 */
export function splitDayTasks(tasks: readonly DayTask[]): DayLists {
  const visible = tasks.filter((t) => t.status !== "SKIPPED");
  const topThree = visible
    .filter((t) => t.isTopThree)
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
    .slice(0, MAX_TOP_THREE);
  const topIds = new Set(topThree.map((t) => t.id));
  const rest = visible.filter((t) => !topIds.has(t.id)).sort(compareByStartThenRank);
  return { topThree, rest };
}

/** True when another Top 3 task fits on a day with these tasks. */
export function hasTopThreeRoom(tasks: readonly DayTask[]): boolean {
  return tasks.filter((t) => t.isTopThree && t.status !== "SKIPPED").length < MAX_TOP_THREE;
}

/** "30m", "1h", "1h 30m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const DURATION_CHOICES = [15, 30, 45, 60, 90] as const;
