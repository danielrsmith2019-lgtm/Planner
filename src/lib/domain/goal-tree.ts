import type { LocalDate } from "./dates";
import type { GoalStatus } from "./stalled";
import {
  computeMetricProgress,
  computeMilestoneProgress,
  computeMilestonesGoalProgress,
  type MilestoneStatus,
  type ProgressMode,
  type TaskStatus,
} from "./progress";

/**
 * The client's cached view of a day (the ['day', date] query) and the pure
 * functions that update it. The optimistic update runs these with the same
 * progress functions the server's completeTask transaction uses, so the ring
 * moves instantly and lands on the same number the server will return.
 */

export type TaskCounts = { todo: number; done: number; skipped: number };

export type MilestoneNode = {
  id: string;
  title: string;
  status: MilestoneStatus;
  weight: number;
  progress: number;
  /** Every task of the milestone, not just today's. */
  counts: TaskCounts;
};

export type GoalNode = {
  id: string;
  title: string;
  color: string;
  status: GoalStatus;
  progressMode: ProgressMode;
  metricUnit: string | null;
  metricTarget: number | null;
  metricCurrent: number;
  progress: number;
  milestones: MilestoneNode[];
};

export type DayTask = {
  id: string;
  goalId: string | null;
  milestoneId: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  isTopThree: boolean;
  scheduledDate: LocalDate | null;
  startMin: number | null;
  durationMin: number | null;
  contribution: number | null;
  rank: string;
  carryCount: number;
  completedAt: Date | null;
};

export type DayData = { date: LocalDate; tasks: DayTask[]; goalTree: GoalNode[] };

export type CompletionDirection = "complete" | "uncomplete";

export type OptimisticCompletion = {
  day: DayData;
  /** Goal progress change (after - before); 0 when nothing moved. */
  delta: number;
  goalId: string | null;
  changed: boolean;
};

function countsToTasks(counts: TaskCounts): { status: TaskStatus }[] {
  return [
    ...Array.from({ length: counts.todo }, () => ({ status: "TODO" as const })),
    ...Array.from({ length: counts.done }, () => ({ status: "DONE" as const })),
    ...Array.from({ length: counts.skipped }, () => ({ status: "SKIPPED" as const })),
  ];
}

const COUNT_KEY: Record<TaskStatus, keyof TaskCounts> = { TODO: "todo", DONE: "done", SKIPPED: "skipped" };

function moveCount(counts: TaskCounts, from: TaskStatus, to: TaskStatus): TaskCounts {
  const next = { ...counts };
  next[COUNT_KEY[from]] = Math.max(0, next[COUNT_KEY[from]] - 1);
  next[COUNT_KEY[to]] += 1;
  return next;
}

const roundToCents = (value: number) => Math.round(value * 100) / 100;

/**
 * Apply completeTask / uncompleteTask to the cached day. Mirrors the server:
 * milestone progress via computeMilestoneProgress, then the goal via
 * computeMilestonesGoalProgress (MILESTONES) or computeMetricProgress (METRIC).
 * Returns the day unchanged if the task isn't in it or is already in that state.
 */
export function applyTaskCompletion(
  day: DayData,
  taskId: string,
  direction: CompletionDirection,
  now: Date,
): OptimisticCompletion {
  const task = day.tasks.find((t) => t.id === taskId);
  const unchanged = { day, delta: 0, goalId: task?.goalId ?? null, changed: false };
  if (task === undefined) return unchanged;
  if (direction === "complete" && task.status === "DONE") return unchanged;
  if (direction === "uncomplete" && task.status !== "DONE") return unchanged;

  const from = task.status;
  const to: TaskStatus = direction === "complete" ? "DONE" : "TODO";
  const tasks = day.tasks.map((t) =>
    t.id === taskId ? { ...t, status: to, completedAt: direction === "complete" ? now : null } : t,
  );

  let delta = 0;
  const goalTree = day.goalTree.map((goal) => {
    if (goal.id !== task.goalId) return goal;

    const milestones = goal.milestones.map((m) => {
      if (m.id !== task.milestoneId) return m;
      const counts = moveCount(m.counts, from, to);
      return { ...m, counts, progress: computeMilestoneProgress({ status: m.status, tasks: countsToTasks(counts) }) };
    });

    let progress = goal.progress;
    let metricCurrent = goal.metricCurrent;
    if (goal.progressMode === "MILESTONES") {
      progress = computeMilestonesGoalProgress(milestones);
    } else {
      const amount = task.contribution ?? 0;
      metricCurrent = roundToCents(metricCurrent + (direction === "complete" ? amount : -amount));
      progress = computeMetricProgress(metricCurrent, goal.metricTarget);
    }
    delta = progress - goal.progress;
    return { ...goal, milestones, progress, metricCurrent };
  });

  return { day: { ...day, tasks, goalTree }, delta, goalId: task.goalId, changed: true };
}

/** What the completion Server Action returns, reduced to what the cache needs. */
export type ServerCompletion = {
  task: DayTask;
  milestone: { id: string; status: MilestoneStatus; progress: number } | null;
  goal: { id: string; progress: number; metricCurrent: number } | null;
};

/**
 * Overwrite the cached task, milestone and goal with the server's values.
 * The optimistic numbers should already match; this makes sure they do.
 */
export function applyServerCompletion(day: DayData, result: ServerCompletion): DayData {
  return {
    ...day,
    tasks: day.tasks.map((t) => (t.id === result.task.id ? result.task : t)),
    goalTree: day.goalTree.map((goal) => {
      if (result.goal === null || goal.id !== result.goal.id) return goal;
      return {
        ...goal,
        progress: result.goal.progress,
        metricCurrent: result.goal.metricCurrent,
        milestones: goal.milestones.map((m) =>
          result.milestone !== null && m.id === result.milestone.id
            ? { ...m, status: result.milestone.status, progress: result.milestone.progress }
            : m,
        ),
      };
    }),
  };
}
