"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTaskAction, resolveCarryOverAction } from "@/actions/tasks";
import { unwrap } from "@/actions/types";
import type { LocalDate } from "@/lib/domain/dates";
import type { DayData } from "@/lib/domain/goal-tree";
import { queryKeys } from "@/queries/keys";
import type { TaskDTO } from "@/services/mappers";
import type { CarryOverDecisions, CarryOverResolution } from "@/services/tasks";

export type NewTaskValues = {
  title: string;
  link: { milestoneId: string } | { goalId: string } | null;
  /** null = backlog */
  scheduledDate: LocalDate | null;
  durationMin: number;
  isTopThree: boolean;
};

/**
 * Create a task from TaskForm. Waits for the server (the Top 3 limit is
 * checked there), then drops the new row into the matching cached day so it
 * appears before the refetch, and refreshes days and goals.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation<TaskDTO, Error, NewTaskValues>({
    mutationFn: async (values) => unwrap(await createTaskAction(values)),
    onSuccess: (task) => {
      if (task.scheduledDate !== null) {
        queryClient.setQueryData<DayData>(queryKeys.day(task.scheduledDate), (day) =>
          day === undefined ? day : { ...day, tasks: [...day.tasks, task] },
        );
      } else {
        for (const [key] of queryClient.getQueriesData<DayData>({ queryKey: ["day"] })) {
          queryClient.setQueryData<DayData>(key, (day) => (day === undefined ? day : { ...day, backlog: [...day.backlog, task] }));
        }
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["day"] }),
        queryClient.invalidateQueries({ queryKey: ["goal"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goals() }),
        queryClient.invalidateQueries({ queryKey: ["week"] }),
      ]),
  });
}

/** Apply the carry-over sheet's choices, then refresh everything they touch. */
export function useResolveCarryOver() {
  const queryClient = useQueryClient();
  return useMutation<CarryOverResolution, Error, CarryOverDecisions>({
    mutationFn: async (decisions) => unwrap(await resolveCarryOverAction(decisions)),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.carryOver() }),
        queryClient.invalidateQueries({ queryKey: ["day"] }),
        queryClient.invalidateQueries({ queryKey: ["goal"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goals() }),
        queryClient.invalidateQueries({ queryKey: ["week"] }),
      ]),
  });
}
