import { queryOptions } from "@tanstack/react-query";
import { getGoalAction, getGoalsAction } from "@/actions/goals";
import { unwrap } from "@/actions/types";
import type { GoalDetail, GoalSummary } from "@/services/day";
import { queryKeys } from "./keys";

export async function getGoals(): Promise<GoalSummary[]> {
  return unwrap(await getGoalsAction());
}

export async function getGoal(id: string): Promise<GoalDetail> {
  return unwrap(await getGoalAction({ goalId: id }));
}

export const goalsQuery = () => queryOptions({ queryKey: queryKeys.goals(), queryFn: getGoals });

export const goalQuery = (id: string) => queryOptions({ queryKey: queryKeys.goal(id), queryFn: () => getGoal(id) });
