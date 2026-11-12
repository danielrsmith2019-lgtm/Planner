import type { LocalDate } from "./dates";
import type { DayData, DayTask } from "./goal-tree";

/**
 * Optimistic scheduling on a cached day (['day', date]): schedule a backlog
 * task, move or resize a block, or send a task back to the backlog. The
 * inverse of any change is just the task's previous placement, which is how
 * undo works.
 */

export type Placement = {
  scheduledDate: LocalDate | null;
  startMin: number | null;
  durationMin: number | null;
  /** Set on undo to put the task back in its old position; otherwise the server appends. */
  rank?: string;
};

export function placementOf(task: DayTask): Placement {
  return { scheduledDate: task.scheduledDate, startMin: task.startMin, durationMin: task.durationMin, rank: task.rank };
}

export function samePlacement(task: DayTask, placement: Placement): boolean {
  return (
    task.scheduledDate === placement.scheduledDate &&
    task.startMin === placement.startMin &&
    task.durationMin === placement.durationMin
  );
}

export function findDayTask(day: DayData, taskId: string): DayTask | undefined {
  return day.tasks.find((t) => t.id === taskId) ?? day.backlog.find((t) => t.id === taskId);
}

/** Apply a placement to the cached day: the task lands in tasks, backlog, or leaves this day's view. */
export function applyPlacement(day: DayData, taskId: string, placement: Placement): DayData {
  const task = findDayTask(day, taskId);
  if (task === undefined) return day;
  const moved: DayTask = {
    ...task,
    ...placement,
    // A task leaving its day loses Top 3 there; the server decides on the new day.
    isTopThree: placement.scheduledDate === day.date ? task.isTopThree : false,
  };
  const tasks = day.tasks.filter((t) => t.id !== taskId);
  const backlog = day.backlog.filter((t) => t.id !== taskId);
  if (placement.scheduledDate === day.date) return { ...day, tasks: [...tasks, moved], backlog };
  if (placement.scheduledDate === null) return { ...day, tasks, backlog: [...backlog, moved] };
  return { ...day, tasks, backlog };
}

/** J/K order: Top 3, then Anytime, then the timeline, each task once. */
export function selectionOrder(lists: readonly (readonly DayTask[])[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const list of lists) {
    for (const task of list) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      order.push(task.id);
    }
  }
  return order;
}

/** The next selection for J (+1) or K (-1); starts at the first or last item, stops at the ends. */
export function moveSelection(order: readonly string[], current: string | null, step: 1 | -1): string | null {
  if (order.length === 0) return null;
  const index = current === null ? -1 : order.indexOf(current);
  if (index === -1) return step === 1 ? (order[0] ?? null) : (order[order.length - 1] ?? null);
  return order[Math.min(Math.max(index + step, 0), order.length - 1)] ?? null;
}
