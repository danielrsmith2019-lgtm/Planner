"use server";

import { createMilestone } from "@/services/goals";
import type { MilestoneDTO } from "@/services/mappers";
import { runAction } from "./result";
import { createMilestoneInput } from "./schemas";
import type { ActionResult } from "./types";

export async function createMilestoneAction(input: unknown): Promise<ActionResult<MilestoneDTO>> {
  return runAction(createMilestoneInput, input, (user, { goalId, ...rest }) => createMilestone(user.id, goalId, rest));
}
