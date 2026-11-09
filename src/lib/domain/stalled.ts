import { addDays, toDayNumber, type LocalDate } from "./dates";
import type { TaskStatus } from "./progress";

/**
 * Stalled goals (blueprint interaction 7): an ACTIVE goal with no TODO task
 * scheduled from today through today + 7 (inclusive). Overdue tasks and
 * backlog tasks don't count; the point is "nothing is planned soon".
 */

export const STALLED_WINDOW_DAYS = 7;

export type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export type StalledGoal = { id: string; status: GoalStatus };

export type StalledTask = {
  goalId: string | null;
  status: TaskStatus;
  /** null = backlog */
  scheduledDate: LocalDate | null;
};

export function isStalled(goal: StalledGoal, tasks: readonly StalledTask[], today: LocalDate): boolean {
  if (goal.status !== "ACTIVE") return false;

  const windowStart = toDayNumber(today);
  const windowEnd = toDayNumber(addDays(today, STALLED_WINDOW_DAYS));

  const hasUpcomingStep = tasks.some((task) => {
    if (task.goalId !== goal.id || task.status !== "TODO" || task.scheduledDate === null) return false;
    const day = toDayNumber(task.scheduledDate);
    return day >= windowStart && day <= windowEnd;
  });

  return !hasUpcomingStep;
}
