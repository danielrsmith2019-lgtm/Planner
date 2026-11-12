"use server";

import { z } from "zod";
import type { GoalDetailData } from "@/lib/domain/goal-detail";
import { getGoalDetail, listGoals, type GoalSummary } from "@/services/day";
import { createGoal, setGoalStatus } from "@/services/goals";
import type { GoalDTO } from "@/services/mappers";
import { runAction } from "./result";
import { createGoalInput, goalIdInput, setGoalStatusInput } from "./schemas";
import type { ActionResult } from "./types";

const noInput = z.undefined();

export async function createGoalAction(input: unknown): Promise<ActionResult<GoalDTO>> {
  return runAction(createGoalInput, input, (user, data) => createGoal(user.id, data));
}

/** Pause, resume, complete or archive. Resuming past 5 active goals returns VALIDATION. */
export async function setGoalStatusAction(input: unknown): Promise<ActionResult<GoalDTO>> {
  return runAction(setGoalStatusInput, input, (user, { goalId, status }) => setGoalStatus(user.id, goalId, status));
}

export async function getGoalsAction(): Promise<ActionResult<GoalSummary[]>> {
  return runAction(noInput, undefined, (user) => listGoals(user.id));
}

export async function getGoalAction(input: { goalId: string }): Promise<ActionResult<GoalDetailData>> {
  return runAction(goalIdInput, input, (user, { goalId }) => getGoalDetail(user.id, goalId));
}
