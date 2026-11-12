import type { GoalStatus } from "./stalled";

/**
 * Goal status transitions offered in the card's overflow menu, and list order.
 * The server (setGoalStatus) is the authority on the 5-active rule; the client
 * uses canActivate only to explain up front why "Resume" will fail.
 */

export const MAX_ACTIVE_GOALS = 5;

/** Shown when a create or resume would make a sixth active goal (server and client). */
export const ACTIVE_GOAL_LIMIT_MESSAGE =
  "You already have 5 active goals. Pause, complete or archive one first, so you can give this one real attention.";

export type GoalStatusAction = {
  to: GoalStatus;
  label: string;
  icon: "pause" | "resume" | "complete" | "archive" | "reopen";
  destructive?: boolean;
};

const ACTIONS: Record<GoalStatus, GoalStatusAction[]> = {
  ACTIVE: [
    { to: "PAUSED", label: "Pause", icon: "pause" },
    { to: "COMPLETED", label: "Mark complete", icon: "complete" },
    { to: "ARCHIVED", label: "Archive", icon: "archive", destructive: true },
  ],
  PAUSED: [
    { to: "ACTIVE", label: "Resume", icon: "resume" },
    { to: "COMPLETED", label: "Mark complete", icon: "complete" },
    { to: "ARCHIVED", label: "Archive", icon: "archive", destructive: true },
  ],
  COMPLETED: [
    { to: "ACTIVE", label: "Reopen", icon: "reopen" },
    { to: "ARCHIVED", label: "Archive", icon: "archive", destructive: true },
  ],
  ARCHIVED: [{ to: "ACTIVE", label: "Restore", icon: "reopen" }],
};

export function goalStatusActions(status: GoalStatus): GoalStatusAction[] {
  return ACTIONS[status];
}

export function countActive(goals: readonly { status: GoalStatus }[]): number {
  return goals.filter((g) => g.status === "ACTIVE").length;
}

/** False when making another goal ACTIVE would exceed the limit. */
export function canActivate(goals: readonly { status: GoalStatus }[]): boolean {
  return countActive(goals) < MAX_ACTIVE_GOALS;
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const LIST_ORDER: GoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"];

/** The Goals screen's sections, in order, skipping empty ones. Rank order within each. */
export function groupGoalsByStatus<T extends { status: GoalStatus }>(goals: readonly T[]) {
  return LIST_ORDER.map((status) => ({ status, goals: goals.filter((g) => g.status === status) })).filter(
    (section) => section.goals.length > 0,
  );
}
