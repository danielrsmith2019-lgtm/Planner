import type { TaskStatus } from "./progress";

/**
 * Alignment score (blueprint Section 3): the share of a day's planned minutes
 * that are linked to goals.
 *
 *   planned  = time-blocked tasks + unscheduled Top 3 tasks (at durationMin)
 *   linked   = planned minutes whose task has a goal (an active goal, when
 *              activeGoalIds is given)
 *   result   = linked / planned, 0..1, or null when nothing is planned
 *
 * Pass the day's tasks. Skipped tasks don't count; done tasks do (they were
 * planned). Overlapping blocks each count in full.
 */

/** Matches the Task.durationMin default in the schema. */
export const DEFAULT_DURATION_MIN = 30;

export type AlignmentTask = {
  goalId: string | null;
  /** null = on the day but not time-blocked */
  startMin: number | null;
  durationMin: number | null;
  isTopThree: boolean;
  status: TaskStatus;
};

export type AlignmentInput = {
  tasks: readonly AlignmentTask[];
  /** When given, only these goals count as linked (e.g. ACTIVE goals). */
  activeGoalIds?: ReadonlySet<string>;
};

function plannedMinutes(task: AlignmentTask): number {
  if (task.status === "SKIPPED") return 0;
  if (task.startMin === null && !task.isTopThree) return 0;
  const duration = task.durationMin ?? DEFAULT_DURATION_MIN;
  return duration > 0 ? duration : 0;
}

export function computeAlignment({ tasks, activeGoalIds }: AlignmentInput): number | null {
  let total = 0;
  let linked = 0;

  for (const task of tasks) {
    const minutes = plannedMinutes(task);
    if (minutes === 0) continue;
    total += minutes;
    const isLinked = task.goalId !== null && (activeGoalIds === undefined || activeGoalIds.has(task.goalId));
    if (isLinked) linked += minutes;
  }

  return total === 0 ? null : linked / total;
}
