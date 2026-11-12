"use server";

import { z } from "zod";
import type { GoalDetailData } from "@/lib/domain/goal-detail";
import { findNextStep, getGoalDetail, listGoals, type GoalSummary, type NextStepResult } from "@/services/day";
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

/** "Schedule next step": the task to schedule, or what to create (findNextStep). */
export async function getNextStepAction(input: { goalId: string }): Promise<ActionResult<NextStepResult>> {
  return runAction(goalIdInput, input, (user, { goalId }) => findNextStep(user.id, goalId));
}
