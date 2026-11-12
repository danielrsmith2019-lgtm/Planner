"use server";

import type { DayData } from "@/lib/domain/goal-tree";
import type { WeekData } from "@/lib/domain/week-board";
import { getDay, getWeek } from "@/services/day";
import { runAction } from "./result";
import { dateInput, weekInput } from "./schemas";
import type { ActionResult } from "./types";

export async function getDayAction(input: { date: string }): Promise<ActionResult<DayData>> {
  return runAction(dateInput, input, (user, { date }) => getDay(user.id, date));
}

/** Seven days of tasks from startDate (Monday) in one request. */
export async function getWeekAction(input: { startDate: string }): Promise<ActionResult<WeekData>> {
  return runAction(weekInput, input, (user, { startDate }) => getWeek(user.id, startDate));
}
