"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
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
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const handlers = useMemo(() => createCompletionHandlers(queryClient), [queryClient]);

  return useMutation<CompletionResult, Error, CompletionVariables, CompletionContext>({
    mutationKey: completionMutationKey,
    mutationFn: handlers.mutationFn,
    onMutate: (variables) => handlers.onMutate(variables),
    onError: (error, variables, context) => handlers.onError(error, variables, context),
    onSettled: (data, error, variables) => handlers.onSettled(data, error, variables),
  });
}
