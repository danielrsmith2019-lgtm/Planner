import "server-only";

import { forUser } from "@/lib/db";
import type { MentionTargetType } from "@/lib/domain/mentions";

/**
 * The "@" picker's one source: goals, milestones and open tasks whose title
 * matches the query (case-insensitive), at most 8, grouped goals first.
 * Each carries its goal's color for the chip and the picker.
 */

export type Mentionable = {
  type: MentionTargetType;
  id: string;
  label: string;
  /** The goal's color, or null for a task with no goal. */
  color: string | null;
  /** The goal's title for milestones and tasks, shown under the label. */
  context: string | null;
};

export const MENTION_LIMIT = 8;
/** How many of each kind make it into the 8, before leftovers are shared out. */
const PER_TYPE = { GOAL: 3, MILESTONE: 3, TASK: 4 } as const;

export async function searchMentionables(userId: string, query: string): Promise<Mentionable[]> {
  const q = query.trim().slice(0, 100);
  const title = q === "" ? undefined : { contains: q, mode: "insensitive" as const };
  return forUser(userId).$transaction(async (tx) => {
    const goals = await tx.goal.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] }, ...(title ? { title } : {}) },
      orderBy: [{ status: "asc" }, { rank: "asc" }],
      take: MENTION_LIMIT,
      select: { id: true, title: true, color: true },
    });
    const milestones = await tx.milestone.findMany({
      where: { status: "OPEN", goal: { status: { in: ["ACTIVE", "PAUSED"] } }, ...(title ? { title } : {}) },
      orderBy: [{ goal: { rank: "asc" } }, { rank: "asc" }],
      take: MENTION_LIMIT,
      select: { id: true, title: true, goal: { select: { title: true, color: true } } },
    });
    const tasks = await tx.task.findMany({
      where: { status: "TODO", ...(title ? { title } : {}) },
      orderBy: [{ scheduledDate: { sort: "desc", nulls: "last" } }, { rank: "asc" }],
      take: MENTION_LIMIT,
      select: { id: true, title: true, goal: { select: { title: true, color: true } } },
    });

    const groups: Record<MentionTargetType, Mentionable[]> = {
      GOAL: goals.map((g) => ({ type: "GOAL", id: g.id, label: g.title, color: g.color, context: null })),
      MILESTONE: milestones.map((m) => ({ type: "MILESTONE", id: m.id, label: m.title, color: m.goal.color, context: m.goal.title })),
      TASK: tasks.map((t) => ({ type: "TASK", id: t.id, label: t.title, color: t.goal?.color ?? null, context: t.goal?.title ?? null })),
    };
    return pickGrouped(groups, MENTION_LIMIT);
  });
}

/**
 * Up to `limit` items, keeping the goal / milestone / task order: each kind
 * first gets its share (3 / 3 / 4), then unused slots go to whatever is left.
 */
export function pickGrouped(groups: Record<MentionTargetType, Mentionable[]>, limit: number): Mentionable[] {
  const order: MentionTargetType[] = ["GOAL", "MILESTONE", "TASK"];
  const take: Record<MentionTargetType, number> = { GOAL: 0, MILESTONE: 0, TASK: 0 };
  let left = limit;
  for (const type of order) {
    take[type] = Math.min(PER_TYPE[type], groups[type].length, left);
    left -= take[type];
  }
  for (const type of order) {
    const extra = Math.min(groups[type].length - take[type], left);
    take[type] += extra;
    left -= extra;
  }
  return order.flatMap((type) => groups[type].slice(0, take[type]));
}
