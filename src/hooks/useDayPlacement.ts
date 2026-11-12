"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleTaskAction, updateTaskAction } from "@/actions/tasks";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import { applyPlacement, type Placement } from "@/lib/domain/day-schedule";
import type { DayData } from "@/lib/domain/goal-tree";
import { queryKeys } from "@/queries/keys";
import type { TaskDTO } from "@/services/mappers";

export type PlacementVariables = { taskId: string; placement: Placement; previous: Placement };
type PlacementContext = { before: DayData | undefined; after: DayData | undefined };

/**
 * Schedule, move, resize, or send to the backlog on Today: optimistic on
 * ['day', date] with applyPlacement, then scheduleTask on the server. On
 * failure the snapshot comes back if nothing else touched the day since;
 * otherwise only this task returns to its previous placement.
 */
export function useDayPlacement(date: LocalDate) {
  const queryClient = useQueryClient();
  const key = queryKeys.day(date);
  return useMutation<TaskDTO, Error, PlacementVariables, PlacementContext>({
    mutationKey: ["placeTask"],
    mutationFn: async ({ taskId, placement }) =>
      unwrap(
        await scheduleTaskAction({
          taskId,
          scheduledDate: placement.scheduledDate,
          startMin: placement.startMin,
          durationMin: placement.durationMin,
          ...(placement.rank === undefined ? {} : { rank: placement.rank }),
        }),
      ),
    onMutate: async ({ taskId, placement }) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const before = queryClient.getQueryData<DayData>(key);
      if (before === undefined) return { before, after: undefined };
      const after = applyPlacement(before, taskId, placement);
      queryClient.setQueryData(key, after);
      return { before, after };
    },
    onError: (_error, { taskId, previous }, context) => {
      if (context?.before === undefined) return;
      if (queryClient.getQueryData(key) === context.after) queryClient.setQueryData(key, context.before);
      else queryClient.setQueryData<DayData>(key, (day) => (day === undefined ? day : applyPlacement(day, taskId, previous)));
    },
    onSuccess: (task) => {
      // Take the server's row (rank, Top 3) without waiting for the refetch.
      const take = <T extends { id: string }>(list: T[]) => list.map((t) => (t.id === task.id ? { ...t, ...task } : t));
      queryClient.setQueryData<DayData>(key, (day) =>
        day === undefined ? day : { ...day, tasks: take(day.tasks), backlog: take(day.backlog) },
      );
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["placeTask"] }) > 1) return;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["day"] }),
        queryClient.invalidateQueries({ queryKey: ["week"] }),
      ]);
    },
  });
}

export type EditTaskValues = {
  title: string;
  link?: { milestoneId: string } | { goalId: string } | null;
  scheduledDate: LocalDate | null;
  durationMin: number;
  isTopThree: boolean;
};

/** The edit sheet's Save (E). Waits for the server, then refreshes what it can touch. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation<TaskDTO, Error, { taskId: string; values: EditTaskValues }>({
    mutationFn: async ({ taskId, values }) => unwrap(await updateTaskAction({ taskId, ...values })),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["day"] }),
        queryClient.invalidateQueries({ queryKey: ["week"] }),
        queryClient.invalidateQueries({ queryKey: ["goal"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goals() }),
      ]),
  });
}
