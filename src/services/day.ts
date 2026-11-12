import "server-only";

import { forUser } from "@/lib/db";
import type { GoalDetailData } from "@/lib/domain/goal-detail";
import type { DayData, GoalNode, MilestoneNode, TaskCounts } from "@/lib/domain/goal-tree";
import type { LocalDate } from "@/lib/domain/dates";
import type { Tx } from "./goals";
import { fromLocalDate, toGoalDTO, toMilestoneDTO, toTaskDTO, type GoalDTO, type MilestoneDTO } from "./mappers";
import { NotFoundError } from "./errors";

/**
 * Read services for the client cache (blueprint Section 3, Challenge 1).
 *
 * getDay returns exactly what the optimistic update needs: the day's tasks
 * plus a slim goal tree (goals -> milestones -> task counts). The counts cover
 * every task of each milestone, not just the day's, because milestone progress
 * is computed from all of them.
 */

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

function toGoalNode(goal: GoalDTO, milestones: MilestoneWithCounts[]): GoalNode {
  return {
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
 * The day's tasks (ordered by rank) and the goal tree: every ACTIVE goal,
 * plus any other goal one of the day's tasks points at (e.g. a paused goal).
 */
export async function getDay(userId: string, date: LocalDate): Promise<DayData> {
  const day = fromLocalDate(date);
  return forUser(userId).$transaction(async (tx) => {
    const tasks = await tx.task.findMany({ where: { scheduledDate: day }, orderBy: { rank: "asc" } });
    const linkedGoalIds = [...new Set(tasks.flatMap((t) => (t.goalId === null ? [] : [t.goalId])))];
    const goals = await tx.goal.findMany({
      where: { OR: [{ status: "ACTIVE" }, { id: { in: linkedGoalIds } }] },
      orderBy: { rank: "asc" },
    });
    const milestones = await milestonesWithCounts(
      tx,
      goals.map((g) => g.id),
    );
    return {
      date,
      tasks: tasks.map(toTaskDTO),
      goalTree: goals.map((g) =>
        toGoalNode(
          toGoalDTO(g),
          milestones.filter((m) => m.goalId === g.id),
        ),
      ),
    };
  });
}

export type GoalSummary = GoalDTO & {
  /** The first OPEN milestone in rank order, for "Next: ..." on the card. */
  nextMilestone: { id: string; title: string } | null;
  milestoneCount: number;
};

/** Goals list: everything but ARCHIVED, in rank order, with each goal's next milestone. */
export async function listGoals(userId: string): Promise<GoalSummary[]> {
  return forUser(userId).$transaction(async (tx) => {
    const goals = await tx.goal.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { rank: "asc" } });
    const milestones = await tx.milestone.findMany({
      where: { goalId: { in: goals.map((g) => g.id) } },
      orderBy: { rank: "asc" },
      select: { id: true, goalId: true, title: true, status: true },
    });
    return goals.map((goal) => {
      const own = milestones.filter((m) => m.goalId === goal.id);
      const next = own.find((m) => m.status === "OPEN");
      return {
        ...toGoalDTO(goal),
        nextMilestone: next === undefined ? null : { id: next.id, title: next.title },
        milestoneCount: own.length,
      };
    });
  });
}

/**
 * One goal with its milestones (task counts and every task) and the tasks
 * linked straight to the goal, newest first: everything the detail page
 * shows and what its optimistic updates need.
 */
export async function getGoalDetail(userId: string, goalId: string): Promise<GoalDetailData> {
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
    return {
      ...dto,
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
