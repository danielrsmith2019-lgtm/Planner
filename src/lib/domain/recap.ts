/**
 * Evening recap (blueprint interaction 5): what got done today, grouped by goal.
 *
 * Built from the day's ActivityEvents, not from task rows, so a task completed
 * and then uncompleted nets out to nothing. For each task, the last
 * TASK_COMPLETED / TASK_UNCOMPLETED event (by occurredAt) decides whether it
 * counts. Goal progress before/after comes from the event payloads:
 * `before` of the goal's first completion event, `after` of its last.
 *
 * Event payload contract (written by the completeTask service):
 *   { before: number, after: number, delta: number }   // goal progress, 0..1
 */

export type RecapEventType =
  | "TASK_COMPLETED"
  | "TASK_UNCOMPLETED"
  | "TASK_CARRIED"
  | "TASK_SKIPPED"
  | "MILESTONE_COMPLETED"
  | "GOAL_COMPLETED"
  | "DAY_PLANNED"
  | "DAY_CLOSED";

export type RecapEvent = {
  type: RecapEventType;
  taskId: string | null;
  goalId: string | null;
  occurredAt: Date | string;
  payload: unknown;
};

export type RecapGoal = { id: string; title: string; color: string };

export type RecapGoalRow = {
  goalId: string;
  title: string;
  color: string;
  tasksDone: number;
  taskIds: string[];
  /** Goal progress before the day's first completion, or null if unknown. */
  progressBefore: number | null;
  /** Goal progress after the day's last completion change, or null if unknown. */
  progressAfter: number | null;
};

export type Recap = {
  /** Goals with at least one task done, in the order of the `goals` argument. */
  goals: RecapGoalRow[];
  /** Done tasks with no goal (or a goal not in `goals`), in completion order. */
  looseTaskIds: string[];
};

const COMPLETION_TYPES = new Set<RecapEventType>(["TASK_COMPLETED", "TASK_UNCOMPLETED"]);

function timeOf(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function readProgress(payload: unknown, key: "before" | "after"): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value: unknown = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildRecap(events: readonly RecapEvent[], goals: readonly RecapGoal[]): Recap {
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));

  // Completion events in time order (stable for equal timestamps).
  const completionEvents = events
    .map((event, index) => ({ event, index, time: timeOf(event.occurredAt) }))
    .filter(({ event }) => event.taskId !== null && COMPLETION_TYPES.has(event.type))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ event }) => event);

  // Net state per task: the last completion event wins. Map keeps first-seen order.
  const lastEventByTask = new Map<string, RecapEvent>();
  const firstCompletionOrder = new Map<string, number>();
  completionEvents.forEach((event, order) => {
    const taskId = event.taskId as string;
    lastEventByTask.set(taskId, event);
    if (event.type === "TASK_COMPLETED" && !firstCompletionOrder.has(taskId)) firstCompletionOrder.set(taskId, order);
  });

  // Progress window per goal, across all of its completion events.
  const progressByGoal = new Map<string, { before: number | null; after: number | null }>();
  for (const event of completionEvents) {
    if (event.goalId === null || !goalsById.has(event.goalId)) continue;
    const window = progressByGoal.get(event.goalId);
    if (window === undefined) {
      progressByGoal.set(event.goalId, {
        before: readProgress(event.payload, "before"),
        after: readProgress(event.payload, "after"),
      });
    } else {
      window.after = readProgress(event.payload, "after");
    }
  }

  const doneByGoal = new Map<string, string[]>();
  const looseTaskIds: string[] = [];
  const doneTasks = [...lastEventByTask.entries()]
    .filter(([, last]) => last.type === "TASK_COMPLETED")
    .sort(([a], [b]) => (firstCompletionOrder.get(a) ?? 0) - (firstCompletionOrder.get(b) ?? 0));

  for (const [taskId, last] of doneTasks) {
    if (last.goalId !== null && goalsById.has(last.goalId)) {
      const list = doneByGoal.get(last.goalId) ?? [];
      list.push(taskId);
      doneByGoal.set(last.goalId, list);
    } else {
      looseTaskIds.push(taskId);
    }
  }

  const rows: RecapGoalRow[] = [];
  for (const goal of goals) {
    const taskIds = doneByGoal.get(goal.id);
    if (taskIds === undefined || taskIds.length === 0) continue;
    const window = progressByGoal.get(goal.id);
    rows.push({
      goalId: goal.id,
      title: goal.title,
      color: goal.color,
      tasksDone: taskIds.length,
      taskIds,
      progressBefore: window?.before ?? null,
      progressAfter: window?.after ?? null,
    });
  }

  return { goals: rows, looseTaskIds };
}
