"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleTaskAction } from "@/actions/tasks";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import { applyWeekMove, findWeekTask, type WeekData, type WeekMove } from "@/lib/domain/week-board";
import { queryKeys } from "@/queries/keys";
import type { TaskDTO } from "@/services/mappers";

type MoveVariables = WeekMove & {
  /** Send the rank to the server, or let it append (target day not on screen). */
  sendRank: boolean;
};
type MoveContext = { before: WeekData | undefined; after: WeekData | undefined };

/**
 * Move a task on the week view: optimistic on ['week', startDate] with
 * applyWeekMove, then scheduleTask on the server (keeping its time and
 * duration). Rolls back on failure; refreshes days and the week when settled.
 */
export function useScheduleTask(weekStart: LocalDate) {
  const queryClient = useQueryClient();
  const key = queryKeys.week(weekStart);
  return useMutation<TaskDTO, Error, MoveVariables, MoveContext>({
    mutationKey: ["scheduleTask", weekStart],
    mutationFn: async ({ taskId, toDate, rank, sendRank }) => {
      const week = queryClient.getQueryData<WeekData>(key);
      const task = week === undefined ? undefined : findWeekTask(week, taskId)?.task;
      return unwrap(
        await scheduleTaskAction({
          taskId,
          scheduledDate: toDate,
          startMin: task?.startMin ?? null,
          durationMin: task?.durationMin ?? null,
          ...(sendRank ? { rank } : {}),
        }),
      );
    },
    onMutate: async (move) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const before = queryClient.getQueryData<WeekData>(key);
      if (before === undefined) return { before, after: undefined };
      const after = applyWeekMove(before, move);
      queryClient.setQueryData(key, after);
      return { before, after };
    },
    onError: (_error, _move, context) => {
      if (context?.before !== undefined && queryClient.getQueryData(key) === context.after) {
        queryClient.setQueryData(key, context.before);
      }
    },
    onSettled: () => {
      // Refetch once the last of a quick series of drags settles.
      if (queryClient.isMutating({ mutationKey: ["scheduleTask", weekStart] }) > 1) return;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["week"] }),
        queryClient.invalidateQueries({ queryKey: ["day"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goals() }),
      ]);
    },
  });
}
