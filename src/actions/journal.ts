"use server";

import { monthBounds } from "@/lib/domain/journal";
import {
  getGoalReflections,
  getJournalEntry,
  listJournalDays,
  saveJournalEntry,
  type GoalReflection,
  type JournalDaySummary,
  type JournalEntryDTO,
} from "@/services/journal";
import { searchMentionables, type Mentionable } from "@/services/mentionables";
import { runAction } from "./result";
import { dateInput, goalIdInput, mentionQueryInput, monthInput, saveJournalInput } from "./schemas";
import type { ActionResult } from "./types";

export async function saveJournalEntryAction(input: unknown): Promise<ActionResult<JournalEntryDTO>> {
  return runAction(saveJournalInput, input, (user, { date, ...rest }) => saveJournalEntry(user.id, date, rest));
}

export async function getJournalAction(input: { date: string }): Promise<ActionResult<JournalEntryDTO | null>> {
  return runAction(dateInput, input, (user, { date }) => getJournalEntry(user.id, date));
}

/** The month calendar: which days have an entry, and their mood. */
export async function getJournalMonthAction(input: { month: string }): Promise<ActionResult<JournalDaySummary[]>> {
  return runAction(monthInput, input, (user, { month }) => {
    const { first, last } = monthBounds(month);
    return listJournalDays(user.id, first, last);
  });
}

/** The "@" picker: goals, milestones and open tasks matching the query (max 8, grouped). */
export async function searchMentionablesAction(input: { query: string }): Promise<ActionResult<Mentionable[]>> {
  return runAction(mentionQueryInput, input, (user, { query }) => searchMentionables(user.id, query));
}

/** Journal blocks that mentioned a goal or its milestones, newest first. */
export async function getGoalReflectionsAction(input: { goalId: string }): Promise<ActionResult<GoalReflection[]>> {
  return runAction(goalIdInput, input, (user, { goalId }) => getGoalReflections(user.id, goalId));
}
