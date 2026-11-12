"use server";

import { monthBounds } from "@/lib/domain/journal";
import { getJournalEntry, listJournalDays, saveJournalEntry, type JournalDaySummary, type JournalEntryDTO } from "@/services/journal";
import { runAction } from "./result";
import { dateInput, monthInput, saveJournalInput } from "./schemas";
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
