import "server-only";

import type { Goal, Milestone } from "@/generated/prisma/client";
import { adminDb, forUser, type ScopedTx } from "@/lib/db";
import { toDayNumber, type LocalDate } from "@/lib/domain/dates";
import { GOAL_COLORS, isGoalColor } from "@/lib/domain/goal-colors";
import { computeGoalProgress, computeMilestoneProgress, type ProgressMode } from "@/lib/domain/progress";
import { rankAfter } from "@/lib/domain/rank";
import { NotFoundError, ValidationError } from "./errors";
import { fromLocalDate, toGoalDTO, toMilestoneDTO, toNumberOrNull, type GoalDTO, type MilestoneDTO } from "./mappers";

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

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** V1 focus rule: at most 5 active goals, one per goal color. */
export const MAX_ACTIVE_GOALS = 5;

export type CreateGoalInput = {
  title: string;
  why?: string | null;
  /** One of GOAL_COLORS. Defaults to the first color no active goal uses. */
  color?: string;
  progressMode: ProgressMode;
  /** Required in METRIC mode, e.g. "km". */
  metricUnit?: string | null;
  /** Required and positive in METRIC mode. */
  metricTarget?: number | null;
  startDate: LocalDate;
  targetDate?: LocalDate | null;
};

function assertDate(value: LocalDate, field: string) {
  try {
    toDayNumber(value);
  } catch {
    throw new ValidationError(`${field} must be a YYYY-MM-DD date.`);
  }
}

export async function createGoal(userId: string, input: CreateGoalInput): Promise<GoalDTO> {
  const title = input.title.trim();
  if (title === "") throw new ValidationError("A goal needs a title.");
  assertDate(input.startDate, "startDate");
  const targetDate = input.targetDate ?? null;
  if (targetDate !== null) {
    assertDate(targetDate, "targetDate");
    if (toDayNumber(targetDate) < toDayNumber(input.startDate)) {
      throw new ValidationError("targetDate can't be before startDate.");
    }
  }
  if (input.color !== undefined && !isGoalColor(input.color)) {
    throw new ValidationError(`color must be one of ${GOAL_COLORS.join(", ")}.`);
  }
  const isMetric = input.progressMode === "METRIC";
  const metricUnit = input.metricUnit?.trim() ?? "";
  const metricTarget = input.metricTarget ?? null;
  if (isMetric && (metricTarget === null || metricTarget <= 0 || metricUnit === "")) {
    throw new ValidationError("A metric goal needs a positive metricTarget and a metricUnit.");
  }

  return forUser(userId).$transaction(async (tx) => {
    const active = await tx.goal.findMany({ where: { status: "ACTIVE" }, select: { color: true } });
    if (active.length >= MAX_ACTIVE_GOALS) {
      throw new ValidationError(`You can have at most ${MAX_ACTIVE_GOALS} active goals. Pause or finish one first.`);
    }
    const used = new Set(active.map((g) => g.color));
    const color = input.color ?? GOAL_COLORS.find((c) => !used.has(c)) ?? GOAL_COLORS[0];
    const last = await tx.goal.findFirst({ orderBy: { rank: "desc" }, select: { rank: true } });

    const goal = await tx.goal.create({
      data: {
        userId,
        title,
        why: input.why?.trim() || null,
        color,
        progressMode: input.progressMode,
        metricUnit: isMetric ? metricUnit : null,
        metricTarget: isMetric ? metricTarget : null,
        startDate: fromLocalDate(input.startDate),
        targetDate: targetDate === null ? null : fromLocalDate(targetDate),
        rank: rankAfter(last?.rank ?? null),
      },
    });
    return toGoalDTO(goal);
  });
}

export type CreateMilestoneInput = {
  title: string;
  description?: string | null;
  /** 1..3, default 1. */
  weight?: number;
  targetDate?: LocalDate | null;
};

/** Adds a milestone at the end of the goal's list and recomputes the goal. */
export async function createMilestone(
  userId: string,
  goalId: string,
  input: CreateMilestoneInput,
): Promise<MilestoneDTO> {
  const title = input.title.trim();
  if (title === "") throw new ValidationError("A milestone needs a title.");
  const weight = input.weight ?? 1;
  if (!Number.isInteger(weight) || weight < 1 || weight > 3) {
    throw new ValidationError("weight must be 1, 2 or 3.");
  }
  if (input.targetDate) assertDate(input.targetDate, "targetDate");

  return forUser(userId).$transaction(async (tx) => {
    const goal = await tx.goal.findUnique({ where: { id: goalId }, select: { id: true } });
    if (goal === null) throw new NotFoundError("Goal", goalId);
    const last = await tx.milestone.findFirst({ where: { goalId }, orderBy: { rank: "desc" }, select: { rank: true } });

    const milestone = await tx.milestone.create({
      data: {
        userId,
        goalId,
        title,
        description: input.description?.trim() || null,
        weight,
        targetDate: input.targetDate ? fromLocalDate(input.targetDate) : null,
        rank: rankAfter(last?.rank ?? null),
      },
    });
    // A new 0% milestone lowers a MILESTONES goal's weighted progress.
    await recomputeGoalInTx(tx, goalId);
    return toMilestoneDTO(milestone);
  });
}
