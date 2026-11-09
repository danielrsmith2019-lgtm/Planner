/**
 * Progress engine (blueprint Section 3, "Progress computation rules").
 *
 * Pure functions over plain objects. Used twice: by services inside the
 * completion transaction, and by client mutations for optimistic updates.
 * No Prisma, no React, no clock. Services convert Prisma Decimal to number
 * before calling in.
 */

export type TaskStatus = "TODO" | "DONE" | "SKIPPED";
export type MilestoneStatus = "OPEN" | "DONE";
export type ProgressMode = "MILESTONES" | "METRIC";

/** An open milestone never shows more than this until the user closes it. */
export const OPEN_MILESTONE_CAP = 0.95;

export type ProgressTask = { status: TaskStatus };

export type ContributingTask = {
  status: TaskStatus;
  /** Metric amount (e.g. 16 for a 16 km run). Null when the task adds nothing. */
  contribution: number | null;
};

export type MilestoneProgressInput = {
  status: MilestoneStatus;
  tasks: readonly ProgressTask[];
};

export type WeightedMilestone = {
  /** 1..3 */
  weight: number;
  /** 0..1, from computeMilestoneProgress */
  progress: number;
};

export type GoalProgressInput =
  | { progressMode: "MILESTONES"; milestones: readonly WeightedMilestone[] }
  | { progressMode: "METRIC"; metricTarget: number | null; tasks: readonly ContributingTask[] };

export type GoalProgressResult = {
  /** 0..1 */
  progress: number;
  /** Recomputed total for METRIC goals; null for MILESTONES goals. */
  metricCurrent: number | null;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}

/** Round to the 2 decimal places the database stores (Decimal(12, 2)). */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Milestone progress:
 * - DONE: 1
 * - otherwise: done / (total - skipped), 0 when nothing counts,
 *   capped at 0.95 so "all tasks done" reads as "ready to close".
 */
export function computeMilestoneProgress({ status, tasks }: MilestoneProgressInput): number {
  if (status === "DONE") return 1;

  let doneCount = 0;
  let countable = 0;
  for (const task of tasks) {
    if (task.status === "SKIPPED") continue;
    countable += 1;
    if (task.status === "DONE") doneCount += 1;
  }

  if (countable === 0) return 0;
  return Math.min(doneCount / countable, OPEN_MILESTONE_CAP);
}

/** Milestones mode: sum(weight * progress) / sum(weight). 0 with no milestones. */
export function computeMilestonesGoalProgress(milestones: readonly WeightedMilestone[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const milestone of milestones) {
    const weight = Math.max(0, milestone.weight);
    weighted += weight * clamp01(milestone.progress);
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return clamp01(weighted / totalWeight);
}

/** Metric mode: the sum of DONE contributions, recomputed so it never drifts. */
export function computeMetricCurrent(tasks: readonly ContributingTask[]): number {
  let total = 0;
  for (const task of tasks) {
    if (task.status === "DONE" && task.contribution !== null) total += task.contribution;
  }
  return roundToCents(total);
}

/** Metric mode: min(current / target, 1). 0 without a positive target. */
export function computeMetricProgress(current: number, target: number | null): number {
  if (target === null || target <= 0) return 0;
  return clamp01(current / target);
}

/** One entry point for both modes; services cache the result on the Goal row. */
export function computeGoalProgress(input: GoalProgressInput): GoalProgressResult {
  if (input.progressMode === "MILESTONES") {
    return { progress: computeMilestonesGoalProgress(input.milestones), metricCurrent: null };
  }
  const metricCurrent = computeMetricCurrent(input.tasks);
  return { progress: computeMetricProgress(metricCurrent, input.metricTarget), metricCurrent };
}
