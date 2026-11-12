import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { completeTaskAction, uncompleteTaskAction } from "@/actions/tasks";
import { unwrap } from "@/actions/types";
import {
  applyCompletionToGoalDetail,
  applyServerCompletionToGoalDetail,
  type GoalDetailData,
} from "@/lib/domain/goal-detail";
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
 *
 * A task can be on screen in two kinds of cache at once: a day
 * (['day', date], from Today or /debug) and a goal detail (['goal', id]).
 * Every cached entry that holds the task is updated together, each with the
 * same src/lib/domain progress functions the server's transaction uses.
 */

export type CompletionVariables = { taskId: string; direction: CompletionDirection };

/** One cache entry this mutation changed: its key, the value before, and what we wrote. */
type Touched =
  | { kind: "day"; key: QueryKey; before: DayData; after: DayData }
  | { kind: "goal"; key: QueryKey; before: GoalDetailData; after: GoalDetailData };

export type CompletionContext = {
  touched: Touched[];
  /** What the client predicted the goal would move by. */
  optimisticDelta: number;
};

export type RunCompletion = (variables: CompletionVariables) => Promise<CompletionResult>;

/** Calls the Server Action; an { ok: false } result becomes a thrown ActionFailure. */
export const runCompletion: RunCompletion = async ({ taskId, direction }) =>
  unwrap(await (direction === "complete" ? completeTaskAction({ taskId }) : uncompleteTaskAction({ taskId })));

/** Shared by every completion, so overlapping ones can see each other. */
export const completionMutationKey = ["completeTask"] as const;

const DAY_PREFIX = ["day"] as const;
const GOAL_PREFIX = ["goal"] as const;

const dayHas = (day: DayData | undefined, taskId: string) =>
  day !== undefined && (day.tasks.some((t) => t.id === taskId) || day.backlog.some((t) => t.id === taskId));
const goalHas = (goal: GoalDetailData | undefined, taskId: string) =>
  goal !== undefined &&
  (goal.looseTasks.some((t) => t.id === taskId) || goal.milestones.some((m) => m.tasks.some((t) => t.id === taskId)));

const inverseOf = (direction: CompletionDirection): CompletionDirection =>
  direction === "complete" ? "uncomplete" : "complete";

export function createCompletionHandlers(
  queryClient: QueryClient,
  run: RunCompletion = runCompletion,
  clock: () => Date = () => new Date(),
) {
  const otherCompletionsInFlight = () =>
    // This mutation still counts as pending while its own callbacks run.
    queryClient.isMutating({ mutationKey: completionMutationKey }) > 1;

  /** Keys of every cached day and goal detail that contain the task. */
  const keysHolding = (taskId: string): QueryKey[] => [
    ...queryClient
      .getQueriesData<DayData>({ queryKey: DAY_PREFIX })
      .filter(([, data]) => dayHas(data, taskId))
      .map(([key]) => key),
    ...queryClient
      .getQueriesData<GoalDetailData>({ queryKey: GOAL_PREFIX })
      .filter(([, data]) => goalHas(data, taskId))
      .map(([key]) => key),
  ];

  return {
    mutationFn: run,

    async onMutate({ taskId, direction }: CompletionVariables): Promise<CompletionContext> {
      // 1. Stop in-flight refetches of every cache showing this task, so an
      //    older response can't land on top of the optimistic value.
      const keys = keysHolding(taskId);
      await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey, exact: true })));

      // 2 + 3. Snapshot each one, apply the completion and recompute
      //        milestone and goal progress with the shared domain functions.
      const now = clock();
      const touched: Touched[] = [];
      let optimisticDelta = 0;
      for (const key of keys) {
        if (key[0] === "day") {
          const before = queryClient.getQueryData<DayData>(key);
          if (before === undefined) continue;
          const result = applyTaskCompletion(before, taskId, direction, now);
          if (!result.changed) continue;
          queryClient.setQueryData(key, result.day);
          touched.push({ kind: "day", key, before, after: result.day });
          optimisticDelta = result.delta;
        } else {
          const before = queryClient.getQueryData<GoalDetailData>(key);
          if (before === undefined) continue;
          const result = applyCompletionToGoalDetail(before, taskId, direction, now);
          if (!result.changed) continue;
          queryClient.setQueryData(key, result.detail);
          touched.push({ kind: "goal", key, before, after: result.detail });
          optimisticDelta = result.delta;
        }
      }
      return { touched, optimisticDelta };
    },

    onError(_error: Error, { taskId, direction }: CompletionVariables, context: CompletionContext | undefined) {
      const now = clock();
      for (const entry of context?.touched ?? []) {
        const current = queryClient.getQueryData(entry.key);
        if (current === entry.after) {
          // 4a. Nothing touched this cache since onMutate: put the snapshot back.
          queryClient.setQueryData(entry.key, entry.before);
        } else if (entry.kind === "day") {
          // 4b. Something changed it after us (another completion, a rollback).
          //     Restoring our snapshot would erase that, so undo only this task.
          queryClient.setQueryData<DayData>(entry.key, (day) =>
            day === undefined ? day : applyTaskCompletion(day, taskId, inverseOf(direction), now).day,
          );
        } else {
          queryClient.setQueryData<GoalDetailData>(entry.key, (goal) =>
            goal === undefined ? goal : applyCompletionToGoalDetail(goal, taskId, inverseOf(direction), now).detail,
          );
        }
      }
    },

    async onSettled(data: CompletionResult | undefined, _error: Error | null, { taskId }: CompletionVariables) {
      // 5. Reconcile: write the server's task, milestone and goal over the
      //    optimistic values in every cache that shows the task.
      if (data !== undefined) {
        const server = { task: data.task, milestone: data.milestone, goal: data.goal };
        for (const key of keysHolding(taskId)) {
          if (key[0] === "day") {
            queryClient.setQueryData<DayData>(key, (day) => (day === undefined ? day : applyServerCompletion(day, server)));
          } else {
            queryClient.setQueryData<GoalDetailData>(key, (goal) =>
              goal === undefined ? goal : applyServerCompletionToGoalDetail(goal, server),
            );
          }
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals() });
      }
      // 6. Refetch from the server once the last of a burst of completions
      //    settles, so a refetch can't overwrite a later optimistic change.
      if (!otherCompletionsInFlight()) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: DAY_PREFIX }),
          queryClient.invalidateQueries({ queryKey: GOAL_PREFIX }),
          // The week view shows done counts; it refetches rather than updating optimistically.
          queryClient.invalidateQueries({ queryKey: ["week"] }),
        ]);
      }
    },
  };
}
