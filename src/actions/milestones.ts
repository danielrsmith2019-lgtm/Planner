"use server";

import { createMilestone } from "@/services/goals";
import type { MilestoneDTO } from "@/services/mappers";
import { setMilestoneStatus, updateMilestone, type MilestoneUpdateResult } from "@/services/milestones";
import { runAction } from "./result";
import { createMilestoneInput, setMilestoneStatusInput, updateMilestoneInput } from "./schemas";
import type { ActionResult } from "./types";

export async function createMilestoneAction(input: unknown): Promise<ActionResult<MilestoneDTO>> {
  return runAction(createMilestoneInput, input, (user, { goalId, ...rest }) => createMilestone(user.id, goalId, rest));
}

/** Reorder (rank) and/or re-weight a milestone. */
export async function updateMilestoneAction(input: unknown): Promise<ActionResult<MilestoneUpdateResult>> {
  return runAction(updateMilestoneInput, input, (user, { milestoneId, ...rest }) => updateMilestone(user.id, milestoneId, rest));
}

/** Close or reopen a milestone. Only ever from an explicit user action. */
export async function setMilestoneStatusAction(input: unknown): Promise<ActionResult<MilestoneUpdateResult>> {
  return runAction(setMilestoneStatusInput, input, (user, { milestoneId, status }) =>
    setMilestoneStatus(user.id, milestoneId, status),
  );
}
