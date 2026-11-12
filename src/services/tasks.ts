import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { forUser } from "@/lib/db";
import { getLocalToday, toDayNumber, type LocalDate } from "@/lib/domain/dates";
import { rankAfter, ranksAfter } from "@/lib/domain/rank";
import { NotFoundError, ValidationError } from "./errors";
import { recomputeGoalInTx, recomputeMilestoneInTx, type Tx } from "./goals";
import {
  fromLocalDate,
  toGoalDTO,
  toMilestoneDTO,
  toTaskDTO,
  type GoalDTO,
  type MilestoneDTO,
  type TaskDTO,
} from "./mappers";

/**
 * Task services (blueprint Section 3, Challenge 1).
 *
 * Every function runs in one forUser(userId).$transaction, so it can only see
 * and change the caller's rows. Cached progress is recomputed with the domain
 * functions in the same transaction as the change that caused it.
 *
 * `now` is injectable for tests; getLocalToday turns it into the user's day.
 */

export type ServiceOptions = { now?: Date };

export type CompletionResult = {
  task: TaskDTO;
  milestone: MilestoneDTO | null;
  goal: GoalDTO | null;
  /** Goal progress change, after - before (0 when unchanged or unlinked). */
  delta: number;
  /** False when the call was a no-op (already in the requested state). */
  changed: boolean;
};

/** Link a task to a milestone (goal comes from the milestone) or straight to a goal. */
export type TaskLink = { milestoneId: string; goalId?: never } | { goalId: string; milestoneId?: never };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function userToday(tx: Tx, userId: string, now: Date): Promise<LocalDate> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { timezone: true, dayStartsAt: true },
  });
  if (user === null) throw new NotFoundError("User", userId);
  return getLocalToday(user, now);
}

/**
 * Invariant: when a task has a milestone, its goalId is the milestone's goalId.
 * It is looked up here and never taken from input.
 */
async function resolveLink(
  tx: Tx,
  link: TaskLink | null,
): Promise<{ goalId: string | null; milestoneId: string | null }> {
  if (link === null) return { goalId: null, milestoneId: null };

  if (link.milestoneId !== undefined) {
    if ((link as { goalId?: unknown }).goalId !== undefined) {
      throw new ValidationError("Pass milestoneId or goalId, not both. A milestone's goal is set automatically.");
    }
    const milestone = await tx.milestone.findUnique({ where: { id: link.milestoneId }, select: { goalId: true } });
    if (milestone === null) throw new NotFoundError("Milestone", link.milestoneId);
    return { goalId: milestone.goalId, milestoneId: link.milestoneId };
  }

  const goal = await tx.goal.findUnique({ where: { id: link.goalId }, select: { id: true } });
  if (goal === null) throw new NotFoundError("Goal", link.goalId);
  return { goalId: goal.id, milestoneId: null };
}

/** Recompute the milestone (if any), then the goal (if any). */
async function recomputeFor(tx: Tx, milestoneId: string | null, goalId: string | null) {
  const milestone = milestoneId === null ? null : await recomputeMilestoneInTx(tx, milestoneId);
  const goal = goalId === null ? null : await recomputeGoalInTx(tx, goalId);
  return { milestone, goal };
}

function assertMinuteOfDay(value: number | null, field: string) {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 1439)) {
    throw new ValidationError(`${field} must be a whole number of minutes from 0 to 1439.`);
  }
}

function assertDuration(value: number | null) {
  if (value !== null && (!Number.isInteger(value) || value <= 0 || value > 1440)) {
    throw new ValidationError("durationMin must be a whole number of minutes from 1 to 1440.");
  }
}

function assertLocalDate(value: LocalDate, field: string) {
  try {
    toDayNumber(value);
  } catch {
    throw new ValidationError(`${field} must be a YYYY-MM-DD date.`);
  }
}

async function snapshot(tx: Tx, taskId: string): Promise<Omit<CompletionResult, "delta" | "changed">> {
  const task = await tx.task.findUnique({ where: { id: taskId }, include: { milestone: true, goal: true } });
  if (task === null) throw new NotFoundError("Task", taskId);
  const { milestone, goal, ...row } = task;
  return {
    task: toTaskDTO(row),
    milestone: milestone === null ? null : toMilestoneDTO(milestone),
    goal: goal === null ? null : toGoalDTO(goal),
  };
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

type CompletionDirection = "complete" | "uncomplete";

async function setCompletion(
  userId: string,
  taskId: string,
  direction: CompletionDirection,
  { now = new Date() }: ServiceOptions,
): Promise<CompletionResult> {
  return forUser(userId).$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId } });
    if (existing === null) throw new NotFoundError("Task", taskId);

    // Conditional update: only one of two racing calls can flip the status.
    const flipped = await tx.task.updateMany({
      where:
        direction === "complete" ? { id: taskId, status: { not: "DONE" } } : { id: taskId, status: "DONE" },
      data: direction === "complete" ? { status: "DONE", completedAt: now } : { status: "TODO", completedAt: null },
    });
    if (flipped.count === 0) {
      return { ...(await snapshot(tx, taskId)), delta: 0, changed: false };
    }

    const { milestone, goal } = await recomputeFor(tx, existing.milestoneId, existing.goalId);
    const delta = goal === null ? 0 : goal.after - goal.before;

    await tx.activityEvent.create({
      data: {
        userId,
        type: direction === "complete" ? "TASK_COMPLETED" : "TASK_UNCOMPLETED",
        localDate: fromLocalDate(await userToday(tx, userId, now)),
        taskId,
        goalId: existing.goalId,
        milestoneId: existing.milestoneId,
        ...(goal === null
          ? {}
          : { payload: { before: goal.before, after: goal.after, delta } satisfies Prisma.InputJsonObject }),
      },
    });

    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (task === null) throw new NotFoundError("Task", taskId);
    return {
      task: toTaskDTO(task),
      milestone: milestone === null ? null : toMilestoneDTO(milestone),
      goal: goal === null ? null : toGoalDTO(goal.goal),
      delta,
      changed: true,
    };
  });
}

/** Mark a task DONE. A second call on a DONE task changes nothing. */
export function completeTask(userId: string, taskId: string, options: ServiceOptions = {}) {
  return setCompletion(userId, taskId, "complete", options);
}

/** The exact inverse of completeTask: DONE back to TODO. No-op unless DONE. */
export function uncompleteTask(userId: string, taskId: string, options: ServiceOptions = {}) {
  return setCompletion(userId, taskId, "uncomplete", options);
}

// ---------------------------------------------------------------------------
// Create and link
// ---------------------------------------------------------------------------

export type CreateTaskInput = {
  title: string;
  notes?: string | null;
  link?: TaskLink | null;
  scheduledDate?: LocalDate | null;
  startMin?: number | null;
  durationMin?: number | null;
  contribution?: number | null;
  isTopThree?: boolean;
  /** Defaults to the end of the task's day (or the backlog). */
  rank?: string;
};

export async function createTask(userId: string, input: CreateTaskInput): Promise<TaskDTO> {
  const title = input.title.trim();
  if (title === "") throw new ValidationError("A task needs a title.");
  const scheduledDate = input.scheduledDate ?? null;
  const startMin = input.startMin ?? null;
  const durationMin = input.durationMin === undefined ? 30 : input.durationMin;
  if (scheduledDate !== null) assertLocalDate(scheduledDate, "scheduledDate");
  if (scheduledDate === null && startMin !== null) {
    throw new ValidationError("A backlog task (no scheduledDate) can't have a start time.");
  }
  assertMinuteOfDay(startMin, "startMin");
  assertDuration(durationMin);

  return forUser(userId).$transaction(async (tx) => {
    const { goalId, milestoneId } = await resolveLink(tx, input.link ?? null);

    let rank = input.rank;
    if (rank === undefined) {
      const last = await tx.task.findFirst({
        where: { scheduledDate: scheduledDate === null ? null : fromLocalDate(scheduledDate) },
        orderBy: { rank: "desc" },
        select: { rank: true },
      });
      rank = rankAfter(last?.rank ?? null);
    }

    const task = await tx.task.create({
      data: {
        userId,
        title,
        notes: input.notes ?? null,
        goalId,
        milestoneId,
        scheduledDate: scheduledDate === null ? null : fromLocalDate(scheduledDate),
        startMin,
        durationMin,
        contribution: input.contribution ?? null,
        isTopThree: input.isTopThree ?? false,
        rank,
      },
    });

    // A new TODO task changes its milestone's denominator.
    await recomputeFor(tx, milestoneId, goalId);
    return toTaskDTO(task);
  });
}

/** Move a task to another milestone or goal (or unlink it with null). */
export async function setTaskLink(userId: string, taskId: string, link: TaskLink | null): Promise<CompletionResult> {
  return forUser(userId).$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId } });
    if (existing === null) throw new NotFoundError("Task", taskId);

    const next = await resolveLink(tx, link);
    if (next.goalId === existing.goalId && next.milestoneId === existing.milestoneId) {
      return { ...(await snapshot(tx, taskId)), delta: 0, changed: false };
    }

    await tx.task.update({ where: { id: taskId }, data: next });

    // Old side first, then new side.
    await recomputeFor(tx, existing.milestoneId, existing.goalId === next.goalId ? null : existing.goalId);
    const { goal } = await recomputeFor(tx, next.milestoneId, next.goalId);

    return { ...(await snapshot(tx, taskId)), delta: goal === null ? 0 : goal.after - goal.before, changed: true };
  });
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export type ScheduleInput = {
  /** null moves the task to the backlog. */
  scheduledDate: LocalDate | null;
  /** Minutes from local midnight; null = on the day but not time-blocked. */
  startMin: number | null;
  durationMin: number | null;
  /** From rankBetween() on the client, for the task's new position. */
  rank: string;
};

export async function scheduleTask(userId: string, taskId: string, input: ScheduleInput): Promise<TaskDTO> {
  if (input.scheduledDate !== null) assertLocalDate(input.scheduledDate, "scheduledDate");
  if (input.scheduledDate === null && input.startMin !== null) {
    throw new ValidationError("A backlog task (no scheduledDate) can't have a start time.");
  }
  assertMinuteOfDay(input.startMin, "startMin");
  assertDuration(input.durationMin);
  if (input.rank.trim() === "") throw new ValidationError("rank is required.");

  return forUser(userId).$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (existing === null) throw new NotFoundError("Task", taskId);

    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        scheduledDate: input.scheduledDate === null ? null : fromLocalDate(input.scheduledDate),
        startMin: input.startMin,
        durationMin: input.durationMin,
        rank: input.rank,
      },
    });
    return toTaskDTO(task);
  });
}

// ---------------------------------------------------------------------------
// Carry-over
// ---------------------------------------------------------------------------

export type CarryOverResult = {
  /** Moved tasks, in their new order at the end of toDate. */
  carried: TaskDTO[];
  /** Requested ids that weren't moved: not TODO, not on fromDate, not yours, or already recurring on toDate. */
  skippedIds: string[];
};

/**
 * Morning triage "keep": move unfinished tasks from fromDate to the end of
 * toDate. Clears the time block (yesterday's 7:30 slot rarely fits today),
 * increments carryCount and logs TASK_CARRIED for each task.
 */
export async function carryOverTasks(
  userId: string,
  fromDate: LocalDate,
  toDate: LocalDate,
  taskIds: readonly string[],
  { now = new Date() }: ServiceOptions = {},
): Promise<CarryOverResult> {
  assertLocalDate(fromDate, "fromDate");
  assertLocalDate(toDate, "toDate");
  if (toDayNumber(toDate) <= toDayNumber(fromDate)) {
    throw new ValidationError("Tasks can only be carried forward to a later day.");
  }
  const uniqueIds = [...new Set(taskIds)];
  if (uniqueIds.length === 0) return { carried: [], skippedIds: [] };

  return forUser(userId).$transaction(async (tx) => {
    const from = fromLocalDate(fromDate);
    const to = fromLocalDate(toDate);

    const candidates = await tx.task.findMany({
      where: { id: { in: uniqueIds }, status: "TODO", scheduledDate: from },
      orderBy: { rank: "asc" },
    });

    // A recurring task can't have two instances on the same day.
    const parentIds = candidates.flatMap((t) => (t.recurrenceParentId === null ? [] : [t.recurrenceParentId]));
    const blockedParents = new Set(
      parentIds.length === 0
        ? []
        : (
            await tx.task.findMany({
              where: { recurrenceParentId: { in: parentIds }, scheduledDate: to },
              select: { recurrenceParentId: true },
            })
          ).map((t) => t.recurrenceParentId),
    );
    const movable = candidates.filter((t) => t.recurrenceParentId === null || !blockedParents.has(t.recurrenceParentId));

    if (movable.length === 0) return { carried: [], skippedIds: uniqueIds };

    const last = await tx.task.findFirst({
      where: { scheduledDate: to },
      orderBy: { rank: "desc" },
      select: { rank: true },
    });
    const ranks = ranksAfter(last?.rank ?? null, movable.length);
    const localDate = fromLocalDate(await userToday(tx, userId, now));

    const carried: TaskDTO[] = [];
    for (const [index, task] of movable.entries()) {
      const updated = await tx.task.update({
        where: { id: task.id },
        data: { scheduledDate: to, startMin: null, rank: ranks[index], carryCount: { increment: 1 } },
      });
      await tx.activityEvent.create({
        data: {
          userId,
          type: "TASK_CARRIED",
          localDate,
          taskId: task.id,
          goalId: task.goalId,
          milestoneId: task.milestoneId,
          payload: { from: fromDate, to: toDate, carryCount: updated.carryCount },
        },
      });
      carried.push(toTaskDTO(updated));
    }

    const movedIds = new Set(movable.map((t) => t.id));
    return { carried, skippedIds: uniqueIds.filter((id) => !movedIds.has(id)) };
  });
}


// ---------------------------------------------------------------------------
// Log progress (metric goals)
// ---------------------------------------------------------------------------

export type LogProgressInput = {
  /** Positive amount in the goal's unit, e.g. 8 for 8 km. */
  amount: number;
  /** Optional label; defaults to "Logged 8 km". */
  title?: string | null;
};

const formatAmount = (value: number) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100));

/**
 * Blueprint Section 3: "log progress" creates an already-DONE task with the
 * contribution, so the goal's metricCurrent stays the sum of DONE tasks (one
 * source of truth). It lands on the user's today, linked to the goal, and
 * logs TASK_COMPLETED with the progress delta like any completion.
 * Unchecking it later is a normal uncompleteTask.
 */
export async function logProgress(
  userId: string,
  goalId: string,
  input: LogProgressInput,
  { now = new Date() }: ServiceOptions = {},
): Promise<CompletionResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ValidationError("Enter an amount above 0.");
  }
  if (input.amount > 1_000_000) throw new ValidationError("That amount is too large.");
  const amount = Math.round(input.amount * 100) / 100;

  return forUser(userId).$transaction(async (tx) => {
    const goal = await tx.goal.findUnique({ where: { id: goalId } });
    if (goal === null) throw new NotFoundError("Goal", goalId);
    if (goal.progressMode !== "METRIC") {
      throw new ValidationError("Log progress is for metric goals. Complete a milestone task instead.");
    }
    const today = await userToday(tx, userId, now);
    const last = await tx.task.findFirst({
      where: { scheduledDate: fromLocalDate(today) },
      orderBy: { rank: "desc" },
      select: { rank: true },
    });
    const title = input.title?.trim() || `Logged ${formatAmount(amount)} ${goal.metricUnit ?? ""}`.trim();

    const created = await tx.task.create({
      data: {
        userId,
        goalId,
        title: title.slice(0, 200),
        status: "DONE",
        completedAt: now,
        scheduledDate: fromLocalDate(today),
        durationMin: null,
        contribution: amount,
        rank: rankAfter(last?.rank ?? null),
      },
    });

    const recomputed = await recomputeGoalInTx(tx, goalId);
    const delta = recomputed.after - recomputed.before;
    await tx.activityEvent.create({
      data: {
        userId,
        type: "TASK_COMPLETED",
        localDate: fromLocalDate(today),
        taskId: created.id,
        goalId,
        payload: { before: recomputed.before, after: recomputed.after, delta } satisfies Prisma.InputJsonObject,
      },
    });
    return { task: toTaskDTO(created), milestone: null, goal: toGoalDTO(recomputed.goal), delta, changed: true };
  });
}
