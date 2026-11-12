import type { QueryClient } from "@tanstack/react-query";
import { completeTaskAction, uncompleteTaskAction } from "@/actions/tasks";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import {
  applyServerCompletion,
  applyTaskCompletion,
  type CompletionDirection,
  type DayData,
} from "@/lib/domain/goal-tree";
import { queryKeys } from "@/queries/keys";
import type { CompletionResult } from "@/services/tasks";

/**
 * The optimistic completion flow, as plain functions so they can be tested
 * against a real QueryClient without React. useCompleteTask wires them into
 * useMutation.
 */

export type CompletionVariables = { taskId: string; direction: CompletionDirection };

export type CompletionContext = {
  /** The ['day', date] cache before this mutation touched it. */
  snapshot: DayData | undefined;
  /** The exact object written to the cache, to tell if anything changed it since. */
  optimistic: DayData | undefined;
  /** What the client predicted the goal would move by. */
  optimisticDelta: number;
};

export type RunCompletion = (variables: CompletionVariables) => Promise<CompletionResult>;

/** Calls the Server Action; an { ok: false } result becomes a thrown ActionFailure. */
export const runCompletion: RunCompletion = async ({ taskId, direction }) =>
  unwrap(await (direction === "complete" ? completeTaskAction({ taskId }) : uncompleteTaskAction({ taskId })));

export const completionMutationKey = (date: LocalDate) => ["completeTask", date] as const;

export function createCompletionHandlers(
  queryClient: QueryClient,
  date: LocalDate,
  run: RunCompletion = runCompletion,
  clock: () => Date = () => new Date(),
) {
  const dayKey = queryKeys.day(date);
  const otherCompletionsInFlight = () =>
    // This mutation still counts as pending while its own callbacks run.
    queryClient.isMutating({ mutationKey: completionMutationKey(date) }) > 1;

  return {
    mutationFn: run,

    async onMutate(variables: CompletionVariables): Promise<CompletionContext> {
      // 1. Stop any in-flight refetch of the day so it can't land on top of
      //    the optimistic value with pre-completion data.
      await queryClient.cancelQueries({ queryKey: dayKey });
      // 2. Snapshot what's there now.
      const snapshot = queryClient.getQueryData<DayData>(dayKey);
      if (snapshot === undefined) return { snapshot, optimistic: undefined, optimisticDelta: 0 };
      // 3. Apply the completion and recompute milestone and goal progress
      //    with the same domain functions the server's transaction uses.
      const optimistic = applyTaskCompletion(snapshot, variables.taskId, variables.direction, clock());
      queryClient.setQueryData<DayData>(dayKey, optimistic.day);
      return { snapshot, optimistic: optimistic.day, optimisticDelta: optimistic.delta };
    },

    onError(_error: Error, variables: CompletionVariables, context: CompletionContext | undefined) {
      if (context?.snapshot === undefined) return;
      const current = queryClient.getQueryData<DayData>(dayKey);
      if (current === context.optimistic) {
        // 4a. Nothing has touched the cache since onMutate: put the snapshot back.
        queryClient.setQueryData<DayData>(dayKey, context.snapshot);
        return;
      }
      // 4b. Something changed the cache after us (another completion's
      //     optimistic update, or one rolling back). Restoring our snapshot
      //     would erase that, so undo only this task by applying the opposite
      //     direction; applyTaskCompletion is its own exact inverse.
      if (current === undefined) return;
      const inverse = variables.direction === "complete" ? "uncomplete" : "complete";
      queryClient.setQueryData<DayData>(dayKey, applyTaskCompletion(current, variables.taskId, inverse, clock()).day);
    },

    async onSettled(data: CompletionResult | undefined) {
      // 5. Reconcile: write the server's task, milestone and goal over the
      //    optimistic ones. They should already match; this guarantees it.
      if (data !== undefined) {
        queryClient.setQueryData<DayData>(dayKey, (day) =>
          day === undefined
            ? day
            : applyServerCompletion(day, {
                task: data.task,
                milestone: data.milestone,
                goal: data.goal,
              }),
        );
        if (data.goal !== null) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.goal(data.goal.id) });
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals() });
      }
      // 6. Refetch the day from the server, but only once the last of a burst
      //    of completions settles, so a refetch can't overwrite a later
      //    optimistic change that the server hasn't seen yet.
      if (!otherCompletionsInFlight()) {
        await queryClient.invalidateQueries({ queryKey: dayKey });
      }
    },
  };
}
