"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGoalAction, setGoalStatusAction } from "@/actions/goals";
import { unwrap } from "@/actions/types";
import type { GoalStatus } from "@/lib/domain/stalled";
import { queryKeys } from "@/queries/keys";
import type { GoalSummary } from "@/services/day";
import type { GoalDTO } from "@/services/mappers";

/**
 * Goal mutations for the Goals screen. Both refresh ['goals'] and every
 * cached ['day', date] when they settle, since the day's goal tree lists the
 * active goals. Failures arrive as ActionFailure with the server's message
 * (e.g. the 5-active-goals rule) and, for create, per-field errors.
 */

export type CreateGoalValues = {
  title: string;
  why: string | null;
  progressMode: "MILESTONES" | "METRIC";
  metricUnit: string | null;
  metricTarget: number | null;
  color: string;
  startDate: string;
  targetDate: string | null;
};

function useRefreshGoals() {
  const queryClient = useQueryClient();
  return (goalId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.goals() }),
      queryClient.invalidateQueries({ queryKey: ["day"] }),
      ...(goalId === undefined ? [] : [queryClient.invalidateQueries({ queryKey: queryKeys.goal(goalId) })]),
    ]);
}

export function useCreateGoal() {
  const refresh = useRefreshGoals();
  return useMutation<GoalDTO, Error, CreateGoalValues>({
    mutationFn: async (values) => unwrap(await createGoalAction(values)),
    onSettled: () => refresh(),
  });
}

type StatusVariables = { goalId: string; status: GoalStatus };
type StatusContext = { snapshot: GoalSummary[] | undefined; optimistic: GoalSummary[] | undefined };

/** Pause, resume, complete or archive, applied to the list immediately and rolled back on failure. */
export function useSetGoalStatus() {
  const queryClient = useQueryClient();
  const refresh = useRefreshGoals();
  const key = queryKeys.goals();

  return useMutation<GoalDTO, Error, StatusVariables, StatusContext>({
    mutationFn: async (variables) => unwrap(await setGoalStatusAction(variables)),
    onMutate: async ({ goalId, status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<GoalSummary[]>(key);
      if (snapshot === undefined) return { snapshot, optimistic: undefined };
      const optimistic =
        status === "ARCHIVED"
          ? snapshot.filter((g) => g.id !== goalId)
          : snapshot.map((g) => (g.id === goalId ? { ...g, status } : g));
      queryClient.setQueryData(key, optimistic);
      return { snapshot, optimistic };
    },
    onError: (_error, _variables, context) => {
      // Only restore if nothing else has changed the list since (same rule as useCompleteTask).
      if (context?.snapshot !== undefined && queryClient.getQueryData(key) === context.optimistic) {
        queryClient.setQueryData(key, context.snapshot);
      }
    },
    onSettled: (_data, _error, { goalId }) => refresh(goalId),
  });
}
