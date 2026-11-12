import "server-only";

import { forUser } from "@/lib/db";
import { addDays, getLocalToday, type LocalDate } from "@/lib/domain/dates";
import type { GoalDetailData } from "@/lib/domain/goal-detail";
import { computeGoalHealth, pickNextStep, sortByHealth, type GoalHealth, type NextStep } from "@/lib/domain/goal-health";
import { STALLED_WINDOW_DAYS } from "@/lib/domain/stalled";
import type { DayData, GoalNode, MilestoneNode, TaskCounts } from "@/lib/domain/goal-tree";
import { weekDates } from "@/lib/domain/week";
import type { WeekData } from "@/lib/domain/week-board";
import type { Tx } from "./goals";
import {
  fromLocalDate,
  toGoalDTO,
  toLocalDate,
  toMilestoneDTO,
  toTaskDTO,
  type GoalDTO,
  type MilestoneDTO,
  type TaskDTO,
} from "./mappers";
import { NotFoundError } from "./errors";

/**
 * Read services for the client cache (blueprint Section 3, Challenge 1).
 *
 * getDay returns exactly what the optimistic update needs: the day's tasks
 * plus a slim goal tree (goals -> milestones -> task counts). The counts cover
 * every task of each milestone, not just the day's, because milestone progress
 * is computed from all of them.
 *
 * Every goal these return carries its health (pace, expectedProgress,
 * isStalled from computeGoalHealth, against the user's local today), and
 * goal lists come back in health order: stalled, behind, on track, ahead.
 */

/** Pass now to pin "today" in tests; defaults to the current time. */
export type ReadOptions = { now?: Date };

const NO_HEALTH: GoalHealth = { pace: null, expectedProgress: null, isStalled: false };

/** The user's local today (getLocalToday), read inside the caller's transaction. */
async function localTodayInTx(tx: Tx, userId: string, now: Date): Promise<LocalDate> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { timezone: true, dayStartsAt: true } });
  if (user === null) throw new NotFoundError("User", userId);
  return getLocalToday(user, now);
}

/**
 * Pace and stalled state for each goal, with one query for the TODO tasks
 * scheduled in the stalled window (today through today + 7).
 */
async function healthInTx(
  tx: Tx,
  userId: string,
  goals: readonly GoalDTO[],
  now: Date,
): Promise<Map<string, GoalHealth>> {
  const health = new Map<string, GoalHealth>();
  if (goals.length === 0) return health;
  const today = await localTodayInTx(tx, userId, now);
  const upcoming = await tx.task.findMany({
    where: {
      goalId: { in: goals.map((g) => g.id) },
      status: "TODO",
      scheduledDate: { gte: fromLocalDate(today), lte: fromLocalDate(addDays(today, STALLED_WINDOW_DAYS)) },
    },
    select: { goalId: true, status: true, scheduledDate: true },
  });
  const tasks = upcoming.map((t) => ({
    goalId: t.goalId,
    status: t.status,
    scheduledDate: t.scheduledDate === null ? null : toLocalDate(t.scheduledDate),
  }));
  for (const goal of goals) health.set(goal.id, computeGoalHealth(goal, tasks, today));
  return health;
}

const EMPTY_COUNTS: TaskCounts = { todo: 0, done: 0, skipped: 0 };

/** Task counts per milestone in one groupBy. */
async function countsByMilestone(tx: Tx, milestoneIds: string[]): Promise<Map<string, TaskCounts>> {
  const counts = new Map<string, TaskCounts>();
  if (milestoneIds.length === 0) return counts;
  const rows = await tx.task.groupBy({
    by: ["milestoneId", "status"],
    where: { milestoneId: { in: milestoneIds } },
    _count: { _all: true },
  });
  for (const row of rows) {
    if (row.milestoneId === null) continue;
    const current = counts.get(row.milestoneId) ?? { ...EMPTY_COUNTS };
    const n = row._count._all;
    if (row.status === "TODO") current.todo += n;
    else if (row.status === "DONE") current.done += n;
    else current.skipped += n;
    counts.set(row.milestoneId, current);
  }
  return counts;
}

export type MilestoneWithCounts = MilestoneDTO & { counts: TaskCounts };

function toMilestoneNode(m: MilestoneWithCounts): MilestoneNode {
  return { id: m.id, title: m.title, status: m.status, weight: m.weight, progress: m.progress, counts: m.counts };
}

function toGoalNode(goal: GoalDTO, milestones: MilestoneWithCounts[], health: GoalHealth): GoalNode {
  return {
    ...health,
    id: goal.id,
    title: goal.title,
    color: goal.color,
    status: goal.status,
    progressMode: goal.progressMode,
    metricUnit: goal.metricUnit,
    metricTarget: goal.metricTarget,
    metricCurrent: goal.metricCurrent,
    progress: goal.progress,
    milestones: milestones.map(toMilestoneNode),
  };
}

async function milestonesWithCounts(tx: Tx, goalIds: string[]): Promise<MilestoneWithCounts[]> {
  if (goalIds.length === 0) return [];
  const rows = await tx.milestone.findMany({ where: { goalId: { in: goalIds } }, orderBy: { rank: "asc" } });
  const counts = await countsByMilestone(
    tx,
    rows.map((m) => m.id),
  );
  return rows.map((m) => ({ ...toMilestoneDTO(m), counts: counts.get(m.id) ?? { ...EMPTY_COUNTS } }));
}

/**
 * Every ACTIVE goal plus any goal the given tasks point at (e.g. a paused
 * goal), with milestone counts and health, in health order.
 */
async function buildGoalTree(
  tx: Tx,
  userId: string,
  tasks: readonly { goalId: string | null }[],
  now: Date,
): Promise<GoalNode[]> {
  const linkedGoalIds = [...new Set(tasks.flatMap((t) => (t.goalId === null ? [] : [t.goalId])))];
  const goals = (
    await tx.goal.findMany({
      where: { OR: [{ status: "ACTIVE" }, { id: { in: linkedGoalIds } }] },
      orderBy: { rank: "asc" },
    })
  ).map(toGoalDTO);
  const milestones = await milestonesWithCounts(
    tx,
    goals.map((g) => g.id),
  );
  const health = await healthInTx(tx, userId, goals, now);
  return sortByHealth(
    goals.map((g) =>
      toGoalNode(
        g,
        milestones.filter((m) => m.goalId === g.id),
        health.get(g.id) ?? NO_HEALTH,
      ),
    ),
  );
}

/**
 * The day's tasks (ordered by rank), the backlog (unscheduled TODO tasks) and
 * the goal tree (buildGoalTree).
 */
export async function getDay(userId: string, date: LocalDate, { now = new Date() }: ReadOptions = {}): Promise<DayData> {
  const day = fromLocalDate(date);
  return forUser(userId).$transaction(async (tx) => {
    const tasks = await tx.task.findMany({ where: { scheduledDate: day }, orderBy: { rank: "asc" } });
    const backlog = await tx.task.findMany({
      where: { scheduledDate: null, status: "TODO" },
      orderBy: { rank: "asc" },
      take: 200,
    });
    return {
      date,
      tasks: tasks.map(toTaskDTO),
      backlog: backlog.map(toTaskDTO),
      goalTree: await buildGoalTree(tx, userId, [...tasks, ...backlog], now),
    };
  });
}

/**
 * Seven days of tasks from startDate (a Monday on the client) in one request,
 * each day in rank order, plus the goal tree for colors and the task form.
 */
export async function getWeek(
  userId: string,
  startDate: LocalDate,
  { now = new Date() }: ReadOptions = {},
): Promise<WeekData> {
  const start = fromLocalDate(startDate);
  const dates = weekDates(startDate);
  const end = fromLocalDate(dates[6] ?? startDate);
  return forUser(userId).$transaction(async (tx) => {
    const tasks = (
      await tx.task.findMany({ where: { scheduledDate: { gte: start, lte: end } }, orderBy: { rank: "asc" } })
    ).map(toTaskDTO);
    return {
      startDate,
      days: dates.map((date) => ({ date, tasks: tasks.filter((t) => t.scheduledDate === date) })),
      goalTree: await buildGoalTree(tx, userId, tasks, now),
    };
  });
}

export type GoalSummary = GoalDTO &
  GoalHealth & {
  /** The first OPEN milestone in rank order, for "Next: ..." on the card. */
  nextMilestone: { id: string; title: string } | null;
  milestoneCount: number;
};

/**
 * Goals list: everything but ARCHIVED, with each goal's next milestone and
 * health, in health order (rank order between goals with the same health).
 */
export async function listGoals(userId: string, { now = new Date() }: ReadOptions = {}): Promise<GoalSummary[]> {
  return forUser(userId).$transaction(async (tx) => {
    const goals = (
      await tx.goal.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { rank: "asc" } })
    ).map(toGoalDTO);
    const milestones = await tx.milestone.findMany({
      where: { goalId: { in: goals.map((g) => g.id) } },
      orderBy: { rank: "asc" },
      select: { id: true, goalId: true, title: true, status: true },
    });
    const health = await healthInTx(tx, userId, goals, now);
    return sortByHealth(
      goals.map((goal) => {
        const own = milestones.filter((m) => m.goalId === goal.id);
        const next = own.find((m) => m.status === "OPEN");
        return {
          ...goal,
          ...(health.get(goal.id) ?? NO_HEALTH),
          nextMilestone: next === undefined ? null : { id: next.id, title: next.title },
          milestoneCount: own.length,
        };
      }),
    );
  });
}

/**
 * One goal with its milestones (task counts and every task) and the tasks
 * linked straight to the goal, newest first: everything the detail page
 * shows and what its optimistic updates need.
 */
export async function getGoalDetail(
  userId: string,
  goalId: string,
  { now = new Date() }: ReadOptions = {},
): Promise<GoalDetailData> {
  return forUser(userId).$transaction(async (tx) => {
    const goal = await tx.goal.findUnique({ where: { id: goalId } });
    if (goal === null) throw new NotFoundError("Goal", goalId);
    const milestones = await milestonesWithCounts(tx, [goal.id]);
    const tasks = (await tx.task.findMany({ where: { goalId }, orderBy: { rank: "asc" } })).map(toTaskDTO);
    const loose = tasks
      .filter((t) => t.milestoneId === null)
      // Open tasks first (rank order), then done ones, newest first.
      .sort((a, b) => {
        if (a.completedAt === null || b.completedAt === null) {
          return a.completedAt === b.completedAt ? 0 : a.completedAt === null ? -1 : 1;
        }
        return b.completedAt.getTime() - a.completedAt.getTime();
      });
    const dto = toGoalDTO(goal);
    const health = await healthInTx(tx, userId, [dto], now);
    return {
      ...dto,
      ...(health.get(dto.id) ?? NO_HEALTH),
      milestones: milestones.map((m) => ({
        id: m.id,
        goalId: m.goalId,
        title: m.title,
        status: m.status,
        weight: m.weight,
        progress: m.progress,
        counts: m.counts,
        targetDate: m.targetDate,
        rank: m.rank,
        completedAt: m.completedAt,
        tasks: tasks.filter((t) => t.milestoneId === m.id),
      })),
      looseTasks: loose,
    };
  });
}

export type NextStepResult =
  | { kind: "task"; task: TaskDTO }
  | { kind: "create"; goalId: string; milestone: { id: string; title: string } | null };

/**
 * "Schedule next step" on a stalled goal (pickNextStep): the first TODO task
 * of the goal's first OPEN milestone, or what to create when there's none.
 */
export async function findNextStep(userId: string, goalId: string): Promise<NextStepResult> {
  return forUser(userId).$transaction(async (tx) => {
    const goal = await tx.goal.findUnique({ where: { id: goalId }, select: { id: true } });
    if (goal === null) throw new NotFoundError("Goal", goalId);
    const milestones = await tx.milestone.findMany({
      where: { goalId },
      orderBy: { rank: "asc" },
      select: { id: true, title: true, status: true, tasks: { select: { id: true, status: true }, orderBy: { rank: "asc" } } },
    });
    const step: NextStep = pickNextStep(milestones);
    if (step.kind === "create") return { kind: "create", goalId, milestone: step.milestone };
    const task = await tx.task.findUnique({ where: { id: step.taskId } });
    if (task === null) throw new NotFoundError("Task", step.taskId);
    return { kind: "task", task: toTaskDTO(task) };
  });
}
