import { queryOptions } from "@tanstack/react-query";
import { getJournalAction } from "@/actions/journal";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import type { JournalEntryDTO } from "@/services/journal";
import { queryKeys } from "./keys";

/** The day's entry, or null when nothing has been written yet. */
export async function getJournal(date: LocalDate): Promise<JournalEntryDTO | null> {
  return unwrap(await getJournalAction({ date }));
}

export const journalQuery = (date: LocalDate) =>
  queryOptions({ queryKey: queryKeys.journal(date), queryFn: () => getJournal(date) });
