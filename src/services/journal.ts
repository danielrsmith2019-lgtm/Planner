import "server-only";

import { Prisma, type JournalEntry } from "@/generated/prisma/client";
import { forUser } from "@/lib/db";
import { toDayNumber, type LocalDate } from "@/lib/domain/dates";
import { extractMentions, extractPlainText, type ExtractedMention } from "@/lib/domain/mentions";
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

function toDTO(entry: JournalEntry, linkCount: number): JournalEntryDTO {
  return {
    id: entry.id,
    date: toLocalDate(entry.date),
    content: entry.content,
    plainText: entry.plainText,
    intention: entry.intention,
    mood: entry.mood,
    version: entry.version,
    linkCount,
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
        return toDTO(created, links.length);
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
      return toDTO(updated, links.length);
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
  return toDTO(row, _count.links);
}
