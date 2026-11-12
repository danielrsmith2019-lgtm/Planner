"use server";

import { getJournalEntry, saveJournalEntry, type JournalEntryDTO } from "@/services/journal";
import { runAction } from "./result";
import { dateInput, saveJournalInput } from "./schemas";
import type { ActionResult } from "./types";

export async function saveJournalEntryAction(input: unknown): Promise<ActionResult<JournalEntryDTO>> {
  return runAction(saveJournalInput, input, (user, { date, ...rest }) => saveJournalEntry(user.id, date, rest));
}

export async function getJournalAction(input: { date: string }): Promise<ActionResult<JournalEntryDTO | null>> {
  return runAction(dateInput, input, (user, { date }) => getJournalEntry(user.id, date));
}
