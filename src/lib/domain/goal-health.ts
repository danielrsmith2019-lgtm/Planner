import type { LocalDate } from "./dates";
import { computeExpectedProgress, paceFromExpected, type PaceStatus } from "./pace";
import type { MilestoneStatus, TaskStatus } from "./progress";
import { isStalled, type GoalStatus, type StalledTask } from "./stalled";

/**
 * Goal health: pace and stalled state, computed together on the server
 * (getDay, getWeek, listGoals, getGoalDetail) and sent with every goal.
 *
 * expectedProgress is sent too, so an optimistic progress change on the
 * client can redo the pace with paceFromExpected without reading the clock.
 * Only ACTIVE goals get a pace; paused, completed and archived goals are
 * neither ahead nor behind.
 */

export type GoalHealth = {
  pace: PaceStatus | null;
  /** 0..1, or null without a target date (or when the goal isn't ACTIVE). */
  expectedProgress: number | null;
  isStalled: boolean;
};

export type HealthGoal = {
  id: string;
  status: GoalStatus;
  progress: number;
  startDate: LocalDate;
  targetDate: LocalDate | null;
};

export function computeGoalHealth(goal: HealthGoal, tasks: readonly StalledTask[], today: LocalDate): GoalHealth {
  if (goal.status !== "ACTIVE") return { pace: null, expectedProgress: null, isStalled: false };
  const expectedProgress = computeExpectedProgress({ startDate: goal.startDate, targetDate: goal.targetDate, today });
  return {
    pace: paceFromExpected(goal.progress, expectedProgress),
    expectedProgress,
    isStalled: isStalled(goal, tasks, today),
  };
}

/** Stalled first, then behind, on track, ahead; goals without a pace last. */
export function healthRank(goal: Pick<GoalHealth, "pace" | "isStalled">): number {
  if (goal.isStalled) return 0;
  switch (goal.pace) {
    case "behind":
      return 1;
    case "on_track":
      return 2;
    case "ahead":
      return 3;
    case null:
      return 4;
  }
}

/** A new array in health order. Stable, so goals with the same health keep their rank order. */
export function sortByHealth<T extends Pick<GoalHealth, "pace" | "isStalled">>(goals: readonly T[]): T[] {
  return goals
    .map((goal, index) => ({ goal, index, rank: healthRank(goal) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.goal);
}

// ---------------------------------------------------------------------------
// Schedule next step
// ---------------------------------------------------------------------------

export type NextStepMilestone = {
  id: string;
  title: string;
  status: MilestoneStatus;
  /** In rank order. */
  tasks: readonly { id: string; status: TaskStatus }[];
};

export type NextStep =
  | { kind: "task"; taskId: string; milestoneId: string }
  /** Nothing to schedule: ask for a new task, in this milestone if there is an open one. */
  | { kind: "create"; milestone: { id: string; title: string } | null };

/**
 * "Schedule next step" on a stalled goal: the first TODO task of the first
 * OPEN milestone (milestones in rank order). If that milestone has no TODO
 * task, or no milestone is open, the user is asked to create one.
 */
export function pickNextStep(milestones: readonly NextStepMilestone[]): NextStep {
  const open = milestones.find((m) => m.status === "OPEN");
  if (open === undefined) return { kind: "create", milestone: null };
  const task = open.tasks.find((t) => t.status === "TODO");
  if (task === undefined) return { kind: "create", milestone: { id: open.id, title: open.title } };
  return { kind: "task", taskId: task.id, milestoneId: open.id };
}
