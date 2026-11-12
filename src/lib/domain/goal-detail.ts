import type { LocalDate } from "./dates";
import {
  applyStatusChangeToGoal,
  nextStatus,
  recomputeGoalFromMilestones,
  type CompletionDirection,
  type DayTask,
  type GoalNode,
  type MilestoneNode,
} from "./goal-tree";
import { computeMilestoneProgress, type MilestoneStatus, type TaskStatus } from "./progress";

/**
 * The goal detail page's cached data (the ['goal', id] query) and the pure
 * updates its mutations apply optimistically. Same progress functions as the
 * server, through goal-tree's applyStatusChangeToGoal.
 */

export type MilestoneDetail = MilestoneNode & {
  goalId: string;
  targetDate: LocalDate | null;
  rank: string;
  completedAt: Date | null;
  /** Every task of the milestone, in rank order. */
  tasks: DayTask[];
};

export type GoalDetailData = Omit<GoalNode, "milestones"> & {
  why: string | null;
  startDate: LocalDate;
  targetDate: LocalDate | null;
  rank: string;
  completedAt: Date | null;
  /** In rank order. */
  milestones: MilestoneDetail[];
  /** Tasks linked straight to the goal (metric logs, loose tasks), newest first. */
  looseTasks: DayTask[];
};

function findTask(detail: GoalDetailData, taskId: string): DayTask | undefined {
  for (const m of detail.milestones) {
    const task = m.tasks.find((t) => t.id === taskId);
    if (task !== undefined) return task;
  }
  return detail.looseTasks.find((t) => t.id === taskId);
}

function replaceTask(detail: GoalDetailData, taskId: string, update: (task: DayTask) => DayTask): GoalDetailData {
  return {
    ...detail,
    milestones: detail.milestones.map((m) =>
      m.tasks.some((t) => t.id === taskId) ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? update(t) : t)) } : m,
    ),
    looseTasks: detail.looseTasks.map((t) => (t.id === taskId ? update(t) : t)),
  };
}

/** completeTask / uncompleteTask applied to the goal detail. Unchanged if the task isn't here or already in that state. */
export function applyCompletionToGoalDetail(
  detail: GoalDetailData,
  taskId: string,
  direction: CompletionDirection,
  now: Date,
): { detail: GoalDetailData; delta: number; changed: boolean } {
  const task = findTask(detail, taskId);
  if (task === undefined) return { detail, delta: 0, changed: false };
  const to = nextStatus(task.status, direction);
  if (to === null) return { detail, delta: 0, changed: false };

  const withTask = replaceTask(detail, taskId, (t) => ({ ...t, status: to, completedAt: to === "DONE" ? now : null }));
  const { goal, delta } = applyStatusChangeToGoal(withTask, task, task.status, to);
  return { detail: goal, delta, changed: true };
}

/** The server's word on one completion, written over the optimistic values. */
export function applyServerCompletionToGoalDetail(
  detail: GoalDetailData,
  result: {
    task: DayTask;
    milestone: { id: string; status: MilestoneStatus; progress: number } | null;
    goal: { id: string; progress: number; metricCurrent: number } | null;
  },
): GoalDetailData {
  if (result.goal === null || result.goal.id !== detail.id) return detail;
  const withTask = replaceTask(detail, result.task.id, () => result.task);
  const { milestone } = result;
  return {
    ...withTask,
    progress: result.goal.progress,
    metricCurrent: result.goal.metricCurrent,
    milestones: withTask.milestones.map((m) =>
      milestone !== null && m.id === milestone.id ? { ...m, status: milestone.status, progress: milestone.progress } : m,
    ),
  };
}

export type MilestoneChange = { status?: MilestoneStatus; weight?: number; rank?: string };

/**
 * A milestone's status, weight or rank changed: recompute it and the goal the
 * way the server does (DONE is 1; OPEN is done / countable, capped at 0.95),
 * and keep the list in rank order.
 */
export function applyMilestoneChange(
  detail: GoalDetailData,
  milestoneId: string,
  change: MilestoneChange,
  now: Date,
): GoalDetailData {
  const milestones = detail.milestones
    .map((m) => {
      if (m.id !== milestoneId) return m;
      const status = change.status ?? m.status;
      const tasks: { status: TaskStatus }[] = m.tasks;
      return {
        ...m,
        status,
        weight: change.weight ?? m.weight,
        rank: change.rank ?? m.rank,
        completedAt: change.status === undefined ? m.completedAt : status === "DONE" ? now : null,
        progress: computeMilestoneProgress({ status, tasks }),
      };
    })
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
  return recomputeGoalFromMilestones(detail, milestones);
}

/**
 * True when completing `taskId` closes out the last open task of its
 * milestone, so the page can ask "Mark milestone complete?". Never used to
 * complete anything automatically.
 */
export function isLastOpenTask(milestone: MilestoneDetail, taskId: string): boolean {
  if (milestone.status !== "OPEN") return false;
  const open = milestone.tasks.filter((t) => t.status === "TODO");
  return open.length === 1 && open[0]?.id === taskId;
}

/** An open milestone with tasks and none left to do: "Ready to close". */
export function isReadyToClose(milestone: MilestoneDetail): boolean {
  return milestone.status === "OPEN" && milestone.counts.todo === 0 && milestone.counts.done > 0;
}

/** Add a just-created task to its milestone (or the loose list) and count it as TODO. */
export function addTaskToGoalDetail(detail: GoalDetailData, task: DayTask): GoalDetailData {
  if (task.goalId !== detail.id) return detail;
  if (task.milestoneId === null) return { ...detail, looseTasks: [task, ...detail.looseTasks] };
  const milestones = detail.milestones.map((m) => {
    if (m.id !== task.milestoneId) return m;
    const key = task.status === "DONE" ? "done" : task.status === "SKIPPED" ? "skipped" : "todo";
    const counts = { ...m.counts, [key]: m.counts[key] + 1 };
    const tasks = [...m.tasks, task];
    return { ...m, counts, tasks, progress: computeMilestoneProgress({ status: m.status, tasks }) };
  });
  return recomputeGoalFromMilestones(detail, milestones);
}
