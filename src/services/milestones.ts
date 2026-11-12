import "server-only";

import { forUser } from "@/lib/db";
import { getLocalToday } from "@/lib/domain/dates";
import type { MilestoneStatus } from "@/lib/domain/progress";
import { NotFoundError, ValidationError } from "./errors";
import { recomputeGoalInTx, recomputeMilestoneInTx, type Tx } from "./goals";
import { fromLocalDate, toGoalDTO, toMilestoneDTO, type GoalDTO, type MilestoneDTO } from "./mappers";

/**
 * Milestone edits from the goal detail page: reorder, re-weight, and close or
 * reopen. Each runs in one forUser transaction and recomputes the cached
 * milestone and goal progress with the domain functions.
 */

export type MilestoneUpdateResult = {
  milestone: MilestoneDTO;
  goal: GoalDTO;
  /** Goal progress change, after - before. */
  delta: number;
};

/** Ranks are base36 keys from rankBetween (see src/lib/domain/rank.ts). */
const RANK_PATTERN = /^[0-9a-z]{1,64}$/;

export type UpdateMilestoneInput = {
  /** New position, from rankBetween(previous.rank, next.rank) on the client. */
  rank?: string;
  /** 1..3 */
  weight?: number;
};

async function finish(tx: Tx, milestoneId: string, goalId: string): Promise<MilestoneUpdateResult> {
  const milestone = await recomputeMilestoneInTx(tx, milestoneId);
  const { goal, before, after } = await recomputeGoalInTx(tx, goalId);
  return { milestone: toMilestoneDTO(milestone), goal: toGoalDTO(goal), delta: after - before };
}

export async function updateMilestone(
  userId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<MilestoneUpdateResult> {
  if (input.rank !== undefined && !RANK_PATTERN.test(input.rank)) {
    throw new ValidationError("rank must come from rankBetween.");
  }
  if (input.weight !== undefined && (!Number.isInteger(input.weight) || input.weight < 1 || input.weight > 3)) {
    throw new ValidationError("weight must be 1, 2 or 3.");
  }
  return forUser(userId).$transaction(async (tx) => {
    const existing = await tx.milestone.findUnique({ where: { id: milestoneId }, select: { goalId: true } });
    if (existing === null) throw new NotFoundError("Milestone", milestoneId);
    await tx.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(input.rank === undefined ? {} : { rank: input.rank }),
        ...(input.weight === undefined ? {} : { weight: input.weight }),
      },
    });
    return finish(tx, milestoneId, existing.goalId);
  });
}

/**
 * Close (DONE) or reopen (OPEN) a milestone. Only ever called by the user:
 * finishing the last task prompts, it never completes the milestone itself.
 * Closing sets progress to 1, stamps completedAt and logs MILESTONE_COMPLETED.
 */
export async function setMilestoneStatus(
  userId: string,
  milestoneId: string,
  status: MilestoneStatus,
  { now = new Date() }: { now?: Date } = {},
): Promise<MilestoneUpdateResult> {
  return forUser(userId).$transaction(async (tx) => {
    const existing = await tx.milestone.findUnique({ where: { id: milestoneId } });
    if (existing === null) throw new NotFoundError("Milestone", milestoneId);
    if (existing.status === status) return finish(tx, milestoneId, existing.goalId);

    await tx.milestone.update({
      where: { id: milestoneId },
      data: { status, completedAt: status === "DONE" ? now : null },
    });
    const result = await finish(tx, milestoneId, existing.goalId);

    if (status === "DONE") {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { timezone: true, dayStartsAt: true } });
      if (user === null) throw new NotFoundError("User", userId);
      await tx.activityEvent.create({
        data: {
          userId,
          type: "MILESTONE_COMPLETED",
          localDate: fromLocalDate(getLocalToday(user, now)),
          goalId: existing.goalId,
          milestoneId,
          payload: { before: result.goal.progress - result.delta, after: result.goal.progress, delta: result.delta },
        },
      });
    }
    return result;
  });
}
