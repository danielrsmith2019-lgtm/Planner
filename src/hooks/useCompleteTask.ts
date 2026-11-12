"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LocalDate } from "@/lib/domain/dates";
import type { CompletionResult } from "@/services/tasks";
import {
  completionMutationKey,
  createCompletionHandlers,
  type CompletionContext,
  type CompletionVariables,
} from "./completion-handlers";

/**
 * Complete or uncomplete a task on `date` with an optimistic update.
 *
 *   const complete = useCompleteTask(date);
 *   complete.mutate({ taskId, direction: "complete" });
 *
 * complete.data is the server's CompletionResult ({ task, milestone, goal,
 * delta, changed }) for the last call. See completion-handlers.ts for the flow.
 */
export function useCompleteTask(date: LocalDate) {
  const queryClient = useQueryClient();
  const handlers = useMemo(() => createCompletionHandlers(queryClient, date), [queryClient, date]);

  return useMutation<CompletionResult, Error, CompletionVariables, CompletionContext>({
    mutationKey: completionMutationKey(date),
    mutationFn: handlers.mutationFn,
    onMutate: (variables) => handlers.onMutate(variables),
    onError: (error, variables, context) => handlers.onError(error, variables, context),
    onSettled: (data) => handlers.onSettled(data),
  });
}
