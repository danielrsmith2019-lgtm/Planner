"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { getNextStepAction } from "@/actions/goals";
import { unwrap } from "@/actions/types";
import ScheduleSheet from "@/components/planner/ScheduleSheet";
import TaskForm from "@/components/planner/TaskForm";
import { linkOptionFor, type TaskFormState } from "@/components/planner/task-form";
import BottomSheet from "@/components/shared/BottomSheet";
import { useDayPlacement } from "@/hooks/useDayPlacement";
import { useCreateTask } from "@/hooks/useTaskMutations";
import type { LocalDate } from "@/lib/domain/dates";
import { placementOf } from "@/lib/domain/day-schedule";
import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { dayQuery } from "@/queries/day";

const FORM_ID = "next-step-form";

type Flow =
  | { step: "idle" }
  | { step: "schedule"; task: DayTask }
  | { step: "create"; goalId: string; milestone: { id: string; title: string } | null };

export type ScheduleNextStep = {
  /** Find the goal's next step and open the right sheet. */
  start: (goalId: string) => void;
  /** The goal whose next step is loading, for the button's pending state. */
  loadingGoalId: string | null;
  error: string | null;
  clearError: () => void;
  /** The sheets; render once wherever the hook is used. */
  sheets: ReactNode;
};

function createFormState(goals: readonly GoalNode[], goalId: string, milestoneId: string | null, today: LocalDate): TaskFormState {
  return {
    title: "",
    link: linkOptionFor(goals, { goalId, milestoneId }),
    dateChoice: "today",
    pickedDate: today,
    durationMin: 30,
    isTopThree: false,
    linkChanged: false,
  };
}

/**
 * "Schedule next step" on a stalled goal. Finds the first TODO task in the
 * goal's first OPEN milestone (getNextStepAction) and opens ScheduleSheet on
 * Next free slot today. With no such task, it asks for one first (TaskForm,
 * linked to that milestone or the goal, dated today), then opens the
 * ScheduleSheet for the new task.
 */
export function useScheduleNextStep(today: LocalDate | null, timezone: string | null): ScheduleNextStep {
  const [flow, setFlow] = useState<Flow>({ step: "idle" });
  const [loadingGoalId, setLoadingGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const day = today ?? "";
  const place = useDayPlacement(day);
  const createTask = useCreateTask();
  // The link picker needs the goal tree; Today already has it cached.
  const tree = useQuery({ ...dayQuery(day), enabled: today !== null && flow.step === "create" });

  const close = () => setFlow({ step: "idle" });

  const start = (goalId: string) => {
    if (today === null || loadingGoalId !== null) return;
    setError(null);
    setLoadingGoalId(goalId);
    getNextStepAction({ goalId })
      .then(unwrap)
      .then((step) => {
        if (step.kind === "task") setFlow({ step: "schedule", task: step.task });
        else {
          createTask.reset();
          setFlow({ step: "create", goalId: step.goalId, milestone: step.milestone });
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't find the next step."))
      .finally(() => setLoadingGoalId(null));
  };

  const saveSchedule = (task: DayTask, placement: ReturnType<typeof placementOf>) => {
    place.mutate({ taskId: task.id, placement, previous: placementOf(task) }, { onError: (e) => setError(e.message) });
    close();
  };

  const sheets =
    today === null ? null : (
      <>
        <ScheduleSheet
          task={flow.step === "schedule" ? flow.task : null}
          today={today}
          timezone={timezone}
          startAtNextFreeToday
          onOpenChange={(open) => {
            if (!open) close();
          }}
          onSave={saveSchedule}
        />
        <BottomSheet
          open={flow.step === "create"}
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title="Add the next step"
          description={
            flow.step !== "create"
              ? undefined
              : flow.milestone === null
                ? "This goal has no open milestones. Add a task for it, then pick a time."
                : `"${flow.milestone.title}" has nothing left to do. Add its next task, then pick a time.`
          }
          primaryAction={{ label: "Add and schedule", form: FORM_ID, pending: createTask.isPending, pendingLabel: "Adding..." }}
          footerNote={
            createTask.error === null ? undefined : (
              <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
                {createTask.error.message}
              </p>
            )
          }
        >
          {flow.step === "create" && tree.isSuccess ? (
            <TaskForm
              key={`${flow.goalId}-${flow.milestone?.id ?? "goal"}`}
              id={FORM_ID}
              today={today}
              viewing={today}
              goals={tree.data.goalTree}
              defaultTopThree={false}
              topThreeFullOn={null}
              initial={createFormState(tree.data.goalTree, flow.goalId, flow.milestone?.id ?? null, today)}
              onSubmit={(values) =>
                createTask.mutate(values, { onSuccess: (task) => setFlow({ step: "schedule", task }) })
              }
            />
          ) : (
            <div className="bc-skeleton h-40 rounded-[14px]" aria-hidden="true" />
          )}
        </BottomSheet>
      </>
    );

  return { start, loadingGoalId, error, clearError: () => setError(null), sheets };
}
