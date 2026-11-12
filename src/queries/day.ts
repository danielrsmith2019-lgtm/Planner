import { queryOptions } from "@tanstack/react-query";
import { getDayAction } from "@/actions/day";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import type { DayData } from "@/lib/domain/goal-tree";
import { queryKeys } from "./keys";

/** The day's tasks plus the slim goal tree (goals -> milestones -> counts). */
export async function getDay(date: LocalDate): Promise<DayData> {
  return unwrap(await getDayAction({ date }));
}

export const dayQuery = (date: LocalDate) =>
  queryOptions({ queryKey: queryKeys.day(date), queryFn: () => getDay(date) });
