import { computeAlignment } from "./alignment";
import type { LocalDate } from "./dates";
import type { DayTask, GoalNode } from "./goal-tree";
import { rankBetween } from "./rank";

/**
 * The week view's cached data (['week', startDate]) and the pure functions
 * behind drag-and-drop and "Move to...". A move writes one row: the task's
 * new date and a rank between its new neighbours (rankBetween).
 */

export type WeekDay = { date: LocalDate; tasks: DayTask[] };

export type WeekData = {
  /** Monday. */
  startDate: LocalDate;
  /** Monday to Sunday, each in rank order. */
  days: WeekDay[];
  goalTree: GoalNode[];
};

const byRank = (a: DayTask, b: DayTask) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);

export function findWeekTask(week: WeekData, taskId: string): { task: DayTask; date: LocalDate } | null {
  for (const day of week.days) {
    const task = day.tasks.find((t) => t.id === taskId);
    if (task !== undefined) return { task, date: day.date };
  }
  return null;
}

export type WeekMove = { taskId: string; toDate: LocalDate; rank: string };

/**
 * Where a drop lands. overTaskId is the task under the pointer, or null for
 * the column itself (append to the end).
 * - Same column: the task takes the over task's slot (like arrayMove), so
 *   dragging down lands after it and dragging up lands before it.
 * - Another column: it goes just before the over task.
 * Returns null when nothing would change.
 */
export function planWeekMove(
  week: WeekData,
  taskId: string,
  toDate: LocalDate,
  overTaskId: string | null,
): WeekMove | null {
  const from = findWeekTask(week, taskId);
  const target = week.days.find((d) => d.date === toDate);
  if (from === null || target === undefined) return null;
  const list = [...target.tasks].sort(byRank);

  if (from.date === toDate) {
    const fromIndex = list.findIndex((t) => t.id === taskId);
    const toIndex = overTaskId === null ? list.length - 1 : list.findIndex((t) => t.id === overTaskId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;
    const moved = [...list];
    const [item] = moved.splice(fromIndex, 1);
    if (item === undefined) return null;
    moved.splice(toIndex, 0, item);
    return { taskId, toDate, rank: rankBetween(moved[toIndex - 1]?.rank ?? null, moved[toIndex + 1]?.rank ?? null) };
  }

  const overIndex = overTaskId === null ? -1 : list.findIndex((t) => t.id === overTaskId);
  const index = overIndex < 0 ? list.length : overIndex;
  return { taskId, toDate, rank: rankBetween(list[index - 1]?.rank ?? null, list[index]?.rank ?? null) };
}

/** "Move to..." from the task sheet: to the end of that day. */
export function planMoveToEnd(week: WeekData, taskId: string, toDate: LocalDate): WeekMove | null {
  const from = findWeekTask(week, taskId);
  if (from === null || from.date === toDate) return null;
  const target = week.days.find((d) => d.date === toDate);
  const last = target === undefined ? null : ([...target.tasks].sort(byRank).at(-1)?.rank ?? null);
  // A day outside this week isn't loaded; the server appends the real rank in that case.
  return { taskId, toDate, rank: rankBetween(last, null) };
}

/** Apply a move to the cached week. A move to a date outside the week removes the task from view. */
export function applyWeekMove(week: WeekData, move: WeekMove): WeekData {
  const found = findWeekTask(week, move.taskId);
  if (found === null) return week;
  const moved: DayTask = { ...found.task, scheduledDate: move.toDate, rank: move.rank };
  return {
    ...week,
    days: week.days.map((day) => {
      const without = day.tasks.filter((t) => t.id !== move.taskId);
      return day.date === move.toDate ? { ...day, tasks: [...without, moved].sort(byRank) } : { ...day, tasks: without };
    }),
  };
}

export type DayStats = {
  done: number;
  /** Tasks on the day, not counting skipped ones. */
  total: number;
  /** computeAlignment for the day (active goals only), or null when nothing is planned. */
  alignment: number | null;
};

export function dayStats(day: WeekDay, goals: readonly GoalNode[]): DayStats {
  const counted = day.tasks.filter((t) => t.status !== "SKIPPED");
  const activeGoalIds = new Set(goals.filter((g) => g.status === "ACTIVE").map((g) => g.id));
  return {
    done: counted.filter((t) => t.status === "DONE").length,
    total: counted.length,
    alignment: computeAlignment({ tasks: day.tasks, activeGoalIds }),
  };
}
