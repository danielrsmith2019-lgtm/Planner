import { queryOptions } from "@tanstack/react-query";
import { getWeekAction } from "@/actions/day";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import type { WeekData } from "@/lib/domain/week-board";
import { queryKeys } from "./keys";

/** Seven days of tasks from startDate (a Monday) in one request. */
export async function getWeek(startDate: LocalDate): Promise<WeekData> {
  return unwrap(await getWeekAction({ startDate }));
}

export const weekQuery = (startDate: LocalDate) =>
  queryOptions({ queryKey: queryKeys.week(startDate), queryFn: () => getWeek(startDate) });
