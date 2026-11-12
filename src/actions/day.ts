"use server";

import type { DayData } from "@/lib/domain/goal-tree";
import { getDay } from "@/services/day";
import { runAction } from "./result";
import { dateInput } from "./schemas";
import type { ActionResult } from "./types";

export async function getDayAction(input: { date: string }): Promise<ActionResult<DayData>> {
  return runAction(dateInput, input, (user, { date }) => getDay(user.id, date));
}
