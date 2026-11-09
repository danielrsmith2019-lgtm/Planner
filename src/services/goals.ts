import "server-only";

import type { Goal, Milestone } from "@/generated/prisma/client";
import { adminDb, type ScopedTx } from "@/lib/db";
import { computeGoalProgress, computeMilestoneProgress } from "@/lib/domain/progress";
import { NotFoundError } from "./errors";
import { toGoalDTO, toNumberOrNull, type GoalDTO } from "./mappers";

/**
 * Goal and milestone cached fields (progress, metricCurrent).
 *
 * Cached values are derived, never typed in: every write goes through the
 * domain functions in src/lib/domain/progress.ts. The *InTx helpers run inside
 * a caller's transaction (a forUser-scoped one from the task services);
 * recomputeGoal is the admin repair job that rebuilds a goal from raw rows.
 */

export type Tx = ScopedTx;

/** Recompute and store one milestone's cached progress. */
export async function recomputeMilestoneInTx(tx: Tx, milestoneId: string): Promise<Milestone> {
  const milestone = await tx.milestone.findUnique({
    where: { id: milestoneId },
    include: { tasks: { select: { status: true } } },
  });
  if (milestone === null) throw new NotFoundError("Milestone", milestoneId);

  const progress = computeMilestoneProgress({ status: milestone.status, tasks: milestone.tasks });
  const { tasks: _tasks, ...row } = milestone;
  if (progress === row.progress) return row;

  return tx.milestone.update({ where: { id: milestoneId }, data: { progress } });
}

export type GoalRecompute = {
  goal: Goal;
  /** Cached progress before this recompute. */
  before: number;
  /** Progress after this recompute. */
  after: number;
};

/**
 * Recompute and store a goal's cached progress (and metricCurrent in METRIC
 * mode, as the sum of DONE contributions). Milestone progress must already be
 * current: call recomputeMilestoneInTx first.
 */
export async function recomputeGoalInTx(tx: Tx, goalId: string): Promise<GoalRecompute> {
  const goal = await tx.goal.findUnique({ where: { id: goalId } });
  if (goal === null) throw new NotFoundError("Goal", goalId);

  const result =
    goal.progressMode === "MILESTONES"
      ? computeGoalProgress({
          progressMode: "MILESTONES",
          milestones: await tx.milestone.findMany({
            where: { goalId },
            select: { weight: true, progress: true },
          }),
        })
      : computeGoalProgress({
          progressMode: "METRIC",
          metricTarget: toNumberOrNull(goal.metricTarget),
          tasks: (
            await tx.task.findMany({ where: { goalId }, select: { status: true, contribution: true } })
          ).map((task) => ({ status: task.status, contribution: toNumberOrNull(task.contribution) })),
        });

  const metricChanged = result.metricCurrent !== null && result.metricCurrent !== goal.metricCurrent.toNumber();
  if (result.progress === goal.progress && !metricChanged) {
    return { goal, before: goal.progress, after: goal.progress };
  }

  const updated = await tx.goal.update({
    where: { id: goalId },
    data: {
      progress: result.progress,
      ...(result.metricCurrent !== null ? { metricCurrent: result.metricCurrent } : {}),
    },
  });
  return { goal: updated, before: goal.progress, after: result.progress };
}

/**
 * Admin repair: rebuild every cached field of a goal (each milestone's
 * progress, then the goal's progress and metricCurrent) from raw task rows.
 * Uses the unscoped client on purpose; run it from an admin route or the
 * nightly job, never from user-facing code.
 */
export async function recomputeGoal(goalId: string): Promise<GoalDTO> {
  return adminDb().$transaction(async (tx) => {
    const milestones = await tx.milestone.findMany({ where: { goalId }, select: { id: true } });
    for (const { id } of milestones) {
      await recomputeMilestoneInTx(tx, id);
    }
    const { goal } = await recomputeGoalInTx(tx, goalId);
    return toGoalDTO(goal);
  });
}
