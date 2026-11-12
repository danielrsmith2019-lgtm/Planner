"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createMilestoneAction, setMilestoneStatusAction, updateMilestoneAction } from "@/actions/milestones";
import { createTaskAction, logProgressAction } from "@/actions/tasks";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import { addTaskToGoalDetail, applyMilestoneChange, type GoalDetailData, type MilestoneChange } from "@/lib/domain/goal-detail";
import type { MilestoneStatus } from "@/lib/domain/progress";
import { queryKeys } from "@/queries/keys";
import type { MilestoneDTO, TaskDTO } from "@/services/mappers";
import type { MilestoneUpdateResult } from "@/services/milestones";
import type { CompletionResult } from "@/services/tasks";

/**
 * Mutations for the goal detail page (['goal', id]). Milestone edits are
 * optimistic with applyMilestoneChange (same domain functions as the server);
 * creates wait for the server, then add the returned row to the cache. Every
 * one refreshes the goals list and cached days when it settles, since both
 * show this goal's progress.
 */

function refreshAround(queryClient: QueryClient, goalId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.goal(goalId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.goals() }),
    queryClient.invalidateQueries({ queryKey: ["day"] }),
  ]);
}

type MilestoneContext = { before: GoalDetailData | undefined; after: GoalDetailData | undefined };

/** Shared optimistic flow for milestone status, weight and rank. */
function useMilestoneChange<V extends { milestoneId: string }>(
  goalId: string,
  toChange: (variables: V) => MilestoneChange,
  run: (variables: V) => Promise<MilestoneUpdateResult>,
) {
  const queryClient = useQueryClient();
  const key = queryKeys.goal(goalId);
  return useMutation<MilestoneUpdateResult, Error, V, MilestoneContext>({
    mutationFn: run,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const before = queryClient.getQueryData<GoalDetailData>(key);
      if (before === undefined) return { before, after: undefined };
      const after = applyMilestoneChange(before, variables.milestoneId, toChange(variables), new Date());
      queryClient.setQueryData(key, after);
      return { before, after };
    },
    onError: (_error, _variables, context) => {
      if (context?.before !== undefined && queryClient.getQueryData(key) === context.after) {
        queryClient.setQueryData(key, context.before);
      }
    },
    onSettled: () => refreshAround(queryClient, goalId),
  });
}

export type ReorderVariables = { milestoneId: string; rank: string };
export type WeightVariables = { milestoneId: string; weight: number };
export type MilestoneStatusVariables = { milestoneId: string; status: MilestoneStatus };

export function useReorderMilestone(goalId: string) {
  return useMilestoneChange<ReorderVariables>(
    goalId,
    ({ rank }) => ({ rank }),
    async (v) => unwrap(await updateMilestoneAction(v)),
  );
}

export function useSetMilestoneWeight(goalId: string) {
  return useMilestoneChange<WeightVariables>(
    goalId,
    ({ weight }) => ({ weight }),
    async (v) => unwrap(await updateMilestoneAction(v)),
  );
}

/** Close or reopen. Only ever called from a button the user pressed. */
export function useSetMilestoneStatus(goalId: string) {
  return useMilestoneChange<MilestoneStatusVariables>(
    goalId,
    ({ status }) => ({ status }),
    async (v) => unwrap(await setMilestoneStatusAction(v)),
  );
}

export type NewMilestoneValues = { title: string; weight: number; targetDate: LocalDate | null };

export function useCreateMilestone(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation<MilestoneDTO, Error, NewMilestoneValues>({
    mutationFn: async (values) => unwrap(await createMilestoneAction({ goalId, ...values })),
    onSettled: () => refreshAround(queryClient, goalId),
  });
}

/** Inline "Add task": a backlog task (no date) linked to the milestone. */
export function useAddMilestoneTask(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation<TaskDTO, Error, { milestoneId: string; title: string }>({
    mutationFn: async ({ milestoneId, title }) =>
      unwrap(await createTaskAction({ title, link: { milestoneId }, scheduledDate: null })),
    onSuccess: (task) => {
      queryClient.setQueryData<GoalDetailData>(queryKeys.goal(goalId), (detail) =>
        detail === undefined ? detail : addTaskToGoalDetail(detail, task),
      );
    },
    onSettled: () => refreshAround(queryClient, goalId),
  });
}

/** Metric goals: an already-DONE task carrying the amount (blueprint Section 3). */
export function useLogProgress(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation<CompletionResult, Error, { amount: number; title: string | null }>({
    mutationFn: async ({ amount, title }) => unwrap(await logProgressAction({ goalId, amount, title })),
    onSuccess: (result) => {
      const { goal } = result;
      queryClient.setQueryData<GoalDetailData>(queryKeys.goal(goalId), (detail) =>
        detail === undefined || goal === null
          ? detail
          : {
              ...detail,
              progress: goal.progress,
              metricCurrent: goal.metricCurrent,
              looseTasks: [result.task, ...detail.looseTasks],
            },
      );
    },
    onSettled: () => refreshAround(queryClient, goalId),
  });
}
