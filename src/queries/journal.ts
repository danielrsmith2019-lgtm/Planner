import { queryOptions } from "@tanstack/react-query";
import { getGoalReflectionsAction, getJournalAction, getJournalMonthAction } from "@/actions/journal";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import type { GoalReflection, JournalDaySummary, JournalEntryDTO } from "@/services/journal";
import { queryKeys } from "./keys";

/** The day's entry, or null when nothing has been written yet. */
export async function getJournal(date: LocalDate): Promise<JournalEntryDTO | null> {
  return unwrap(await getJournalAction({ date }));
}

export const journalQuery = (date: LocalDate) =>
  queryOptions({ queryKey: queryKeys.journal(date), queryFn: () => getJournal(date) });

export async function getJournalMonth(month: string): Promise<JournalDaySummary[]> {
  return unwrap(await getJournalMonthAction({ month }));
}

export const journalMonthQuery = (month: string) =>
  queryOptions({ queryKey: queryKeys.journalMonth(month), queryFn: () => getJournalMonth(month) });

export async function getGoalReflections(goalId: string): Promise<GoalReflection[]> {
  return unwrap(await getGoalReflectionsAction({ goalId }));
}

export const goalReflectionsQuery = (goalId: string) =>
  queryOptions({ queryKey: queryKeys.goalReflections(goalId), queryFn: () => getGoalReflections(goalId) });
