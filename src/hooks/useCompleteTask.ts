"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ringAnimations } from "@/components/goals/ring-animations";
import type { CompletionResult } from "@/services/tasks";
import {
  completionMutationKey,
  createCompletionHandlers,
  type CompletionContext,
  type CompletionVariables,
} from "./completion-handlers";

/**
 * Complete or uncomplete a task with an optimistic update, wherever it's shown.
 *
 *   const complete = useCompleteTask();
 *   complete.mutate({ taskId, direction: "complete" });
 *
 * Updates every cached ['day', date] and ['goal', id] holding the task.
 * complete.data is the server's CompletionResult ({ task, milestone, goal,
 * delta, changed }). See completion-handlers.ts for the step-by-step flow.
 *
 * Ring animation: when the prediction moves a goal up, its rings hold the old
 * value; once the server settles with delta > 0 they sweep from old to new
 * and show "+N%" (ring-animations.ts).
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const handlers = useMemo(() => createCompletionHandlers(queryClient), [queryClient]);

  return useMutation<CompletionResult, Error, CompletionVariables, CompletionContext>({
    mutationKey: completionMutationKey,
    mutationFn: handlers.mutationFn,
    onMutate: async (variables) => {
      const context = await handlers.onMutate(variables);
      if (context.rise !== null) ringAnimations.hold(context.rise.goalId, context.rise.before);
      return context;
    },
    onError: (error, variables, context) => handlers.onError(error, variables, context),
    onSettled: (data, error, variables, context) => {
      const goalId = data?.goal?.id ?? context?.rise?.goalId ?? null;
      if (goalId !== null) {
        const move =
          data !== undefined && data.changed && data.goal !== null && data.delta > 0
            ? { from: data.goal.progress - data.delta, to: data.goal.progress }
            : null;
        const wasHeld = context?.rise?.goalId === goalId;
        if (wasHeld || move !== null) ringAnimations.release(goalId, move, wasHeld);
      }
      return handlers.onSettled(data, error, variables);
    },
  });
}
