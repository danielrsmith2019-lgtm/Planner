import "server-only";

import { Prisma, type JournalEntry } from "@/generated/prisma/client";
import { forUser } from "@/lib/db";
import { toDayNumber, type LocalDate } from "@/lib/domain/dates";
import { blockIdsInOrder, extractMentions, extractPlainText, type ExtractedMention } from "@/lib/domain/mentions";
import { StaleEntryError, ValidationError } from "./errors";
import type { Tx } from "./goals";
import { fromLocalDate, toLocalDate } from "./mappers";

/**
 * Journal saves (blueprint Section 3, "Saving").
 *
 * One entry per user per local day. Saves use optimistic concurrency: the
 * client sends the version it last loaded (0 for a new entry), the save only
 * applies if the stored version still matches, and the version goes up by one.
 * In the same transaction the entry's plainText is recomputed and all its
 * JournalLinks are replaced with the mentions now in the document.
 */

export type SaveJournalInput = {
  /** Tiptap JSON document ({ type: "doc", ... }). */
  content: unknown;
  /** The version the client last loaded; 0 when the entry is new. */
  version: number;
  /** Omit to keep the stored value; null to clear it. */
  intention?: string | null;
  /** 1..5. Omit to keep the stored value; null to clear it. */
  mood?: number | null;
};

export type JournalEntryDTO = {
  id: string;
  date: LocalDate;
  content: unknown;
  plainText: string;
  intention: string | null;
  mood: number | null;
  version: number;
  linkCount: number;
  /** Goal color per mention id in this entry, so mention chips render in their goal's color. */
  mentionColors: Record<string, string>;
};

const INTENTION_MAX_LENGTH = 500;

function validate(date: LocalDate, input: SaveJournalInput) {
  try {
    toDayNumber(date);
  } catch {
    throw new ValidationError("date must be a YYYY-MM-DD date.");
  }
  if (!Number.isInteger(input.version) || input.version < 0) {
    throw new ValidationError("version must be a whole number, 0 for a new entry.");
  }
  const content = input.content;
  if (typeof content !== "object" || content === null || (content as { type?: unknown }).type !== "doc") {
    throw new ValidationError('content must be a Tiptap document ({ type: "doc" }).');
  }
  if (input.mood !== undefined && input.mood !== null && (!Number.isInteger(input.mood) || input.mood < 1 || input.mood > 5)) {
    throw new ValidationError("mood must be a whole number from 1 to 5.");
  }
  if (typeof input.intention === "string" && input.intention.length > INTENTION_MAX_LENGTH) {
    throw new ValidationError(`intention must be at most ${INTENTION_MAX_LENGTH} characters.`);
  }
}

/**
 * Keep only mentions of things this user owns (ids come from the client), and
 * drop duplicates: the same target twice in one block is one link. The
 * JournalLink unique index can't catch those duplicates itself, because two
 * of its three target columns are always NULL.
 */
async function ownedUniqueMentions(tx: Tx, mentions: ExtractedMention[]): Promise<ExtractedMention[]> {
  const idsOf = (type: ExtractedMention["targetType"]) => [
    ...new Set(mentions.filter((m) => m.targetType === type).map((m) => m.targetId)),
  ];
  const goalIds = idsOf("GOAL");
  const milestoneIds = idsOf("MILESTONE");
  const taskIds = idsOf("TASK");

  const [goals, milestones, tasks] = [
    goalIds.length ? await tx.goal.findMany({ where: { id: { in: goalIds } }, select: { id: true } }) : [],
    milestoneIds.length ? await tx.milestone.findMany({ where: { id: { in: milestoneIds } }, select: { id: true } }) : [],
    taskIds.length ? await tx.task.findMany({ where: { id: { in: taskIds } }, select: { id: true } }) : [],
  ];
  const owned = {
    GOAL: new Set(goals.map((g) => g.id)),
    MILESTONE: new Set(milestones.map((m) => m.id)),
    TASK: new Set(tasks.map((t) => t.id)),
  };

  const seen = new Set<string>();
  return mentions.filter((m) => {
    if (!owned[m.targetType].has(m.targetId)) return false;
    const key = `${m.blockId}|${m.targetType}|${m.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toLinkRows(mentions: ExtractedMention[]): Prisma.JournalLinkCreateWithoutEntryInput[] {
  return mentions.map((m) => ({
    blockId: m.blockId,
    targetType: m.targetType,
    snippet: m.snippet,
    ...(m.targetType === "GOAL" ? { goal: { connect: { id: m.targetId } } } : {}),
    ...(m.targetType === "MILESTONE" ? { milestone: { connect: { id: m.targetId } } } : {}),
    ...(m.targetType === "TASK" ? { task: { connect: { id: m.targetId } } } : {}),
  }));
}

function toDTO(entry: JournalEntry, linkCount: number, mentionColors: Record<string, string> = {}): JournalEntryDTO {
  return {
    id: entry.id,
    date: toLocalDate(entry.date),
    content: entry.content,
    plainText: entry.plainText,
    intention: entry.intention,
    mood: entry.mood,
    version: entry.version,
    linkCount,
    mentionColors,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function saveJournalEntry(
  userId: string,
  date: LocalDate,
  input: SaveJournalInput,
): Promise<JournalEntryDTO> {
  validate(date, input);
  const day = fromLocalDate(date);
  const content = input.content as Prisma.InputJsonObject;
  const plainText = extractPlainText(content);
  const optional = {
    ...(input.intention !== undefined ? { intention: input.intention?.trim() || null } : {}),
    ...(input.mood !== undefined ? { mood: input.mood } : {}),
  };

  try {
    return await forUser(userId).$transaction(async (tx) => {
      const mentions = await ownedUniqueMentions(tx, extractMentions(content));
      const links = toLinkRows(mentions);
      const existing = await tx.journalEntry.findUnique({
        where: { userId_date: { userId, date: day } },
        select: { id: true, version: true },
      });

      if (existing === null) {
        if (input.version !== 0) throw new StaleEntryError(date, input.version, 0);
        const created = await tx.journalEntry.create({
          data: { userId, date: day, content, plainText, version: 1, ...optional, links: { create: links } },
        });
        return toDTO(created, links.length, await mentionColorsInTx(tx, created.id));
      }

      if (existing.version !== input.version) throw new StaleEntryError(date, input.version, existing.version);

      // The version filter makes the write conditional even if another save
      // lands between the read above and this update.
      const updated = await tx.journalEntry.update({
        where: { id: existing.id, version: input.version },
        data: {
          content,
          plainText,
          version: { increment: 1 },
          ...optional,
          links: { deleteMany: {}, create: links },
        },
      });
      return toDTO(updated, links.length, await mentionColorsInTx(tx, updated.id));
    });
  } catch (error) {
    if (isUniqueViolation(error) || isRecordNotFound(error)) {
      // Lost a race with another save of the same entry.
      const current = await forUser(userId).journalEntry.findUnique({
        where: { userId_date: { userId, date: day } },
        select: { version: true },
      });
      throw new StaleEntryError(date, input.version, current?.version ?? 0);
    }
    throw error;
  }
}

/** The entry for a day, or null if nothing has been written yet. */
export async function getJournalEntry(userId: string, date: LocalDate): Promise<JournalEntryDTO | null> {
  const entry = await forUser(userId).journalEntry.findUnique({
    where: { userId_date: { userId, date: fromLocalDate(date) } },
    include: { _count: { select: { links: true } } },
  });
  if (entry === null) return null;
  const { _count, ...row } = entry;
  return toDTO(row, _count.links, await getMentionColors(userId, row.id));
}

export type JournalDaySummary = {
  date: LocalDate;
  mood: number | null;
  /** True when the entry has any text (an entry can exist with only a mood). */
  hasText: boolean;
};

/** Entries between two dates (inclusive), for the month calendar's dots. */
export async function listJournalDays(userId: string, from: LocalDate, to: LocalDate): Promise<JournalDaySummary[]> {
  try {
    if (toDayNumber(to) < toDayNumber(from)) throw new ValidationError("to must be on or after from.");
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("from and to must be YYYY-MM-DD dates.");
  }
  const entries = await forUser(userId).journalEntry.findMany({
    where: { date: { gte: fromLocalDate(from), lte: fromLocalDate(to) } },
    orderBy: { date: "asc" },
    select: { date: true, mood: true, plainText: true },
  });
  return entries.map((e) => ({ date: toLocalDate(e.date), mood: e.mood, hasText: e.plainText.trim() !== "" }));
}

export type GoalReflection = {
  linkId: string;
  date: LocalDate;
  blockId: string;
  snippet: string;
  /** The milestone this block mentioned, or null when it mentioned the goal itself. */
  milestone: { id: string; title: string } | null;
};

/**
 * Every journal block that mentioned a goal or one of its milestones,
 * newest entry first (blueprint: the goal detail's reflection timeline).
 */
export async function getGoalReflections(userId: string, goalId: string): Promise<GoalReflection[]> {
  const links = await forUser(userId).journalLink.findMany({
    where: { OR: [{ goalId }, { milestone: { goalId } }] },
    include: { entry: { select: { id: true, date: true, content: true } }, milestone: { select: { id: true, title: true } } },
    orderBy: [{ entry: { date: "desc" } }, { id: "asc" }],
    take: 200,
  });
  // Within an entry, top to bottom: the order the blocks appear in the document.
  const positions = new Map<string, Map<string, number>>();
  const positionOf = (entryId: string, content: unknown, blockId: string) => {
    let order = positions.get(entryId);
    if (order === undefined) {
      order = new Map(blockIdsInOrder(content).map((id, index) => [id, index]));
      positions.set(entryId, order);
    }
    return order.get(blockId) ?? Number.MAX_SAFE_INTEGER;
  };
  const sorted = [...links].sort((a, b) => {
    const byDate = b.entry.date.getTime() - a.entry.date.getTime();
    if (byDate !== 0) return byDate;
    const byBlock = positionOf(a.entry.id, a.entry.content, a.blockId) - positionOf(b.entry.id, b.entry.content, b.blockId);
    if (byBlock !== 0) return byBlock;
    // Same block: the goal mention before its milestones.
    return (a.milestone === null ? 0 : 1) - (b.milestone === null ? 0 : 1);
  });
  return sorted.map((link) => ({
    linkId: link.id,
    date: toLocalDate(link.entry.date),
    blockId: link.blockId,
    snippet: link.snippet,
    milestone: link.milestone === null ? null : { id: link.milestone.id, title: link.milestone.title },
  }));
}

/** Goal colors for the mentions already in an entry, keyed by mention id (for the chips). */
export async function getMentionColors(userId: string, entryId: string): Promise<Record<string, string>> {
  return forUser(userId).$transaction((tx) => mentionColorsInTx(tx, entryId));
}

async function mentionColorsInTx(tx: Tx, entryId: string): Promise<Record<string, string>> {
  const links = await tx.journalLink.findMany({
    where: { entryId },
    select: {
      goal: { select: { id: true, color: true } },
      milestone: { select: { id: true, goal: { select: { color: true } } } },
      task: { select: { id: true, goal: { select: { color: true } } } },
    },
  });
  const colors: Record<string, string> = {};
  for (const link of links) {
    if (link.goal !== null) colors[link.goal.id] = link.goal.color;
    if (link.milestone !== null) colors[link.milestone.id] = link.milestone.goal.color;
    if (link.task?.goal != null) colors[link.task.id] = link.task.goal.color;
  }
  return colors;
}
