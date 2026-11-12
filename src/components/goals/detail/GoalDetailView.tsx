"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useCompleteTask } from "@/hooks/useCompleteTask";
import {
  useAddMilestoneTask,
  useCreateMilestone,
  useLogProgress,
  useReorderMilestone,
  useSetMilestoneStatus,
  useSetMilestoneWeight,
} from "@/hooks/useGoalDetailMutations";
import { isLastOpenTask, isReadyToClose, type MilestoneDetail } from "@/lib/domain/goal-detail";
import type { DayTask } from "@/lib/domain/goal-tree";
import { goalQuery } from "@/queries/goals";
import { Icon } from "@/utils/icons";
import AddMilestoneSheet from "./AddMilestoneSheet";
import GoalHeader from "./GoalHeader";
import LogProgressSheet from "./LogProgressSheet";
import MilestoneActionsSheet from "./MilestoneActionsSheet";
import MilestoneList from "./MilestoneList";
import ReflectionsList from "./ReflectionsList";
import TaskCheckRow from "./TaskCheckRow";

/**
 * Goal detail: header, sortable milestones with their tasks, the metric log,
 * and an empty Reflections section (journal mentions arrive on Day 19).
 * Everything reads and writes the ['goal', id] cache.
 */
export default function GoalDetailView({ goalId }: { goalId: string }) {
  const goal = useQuery(goalQuery(goalId));
  const complete = useCompleteTask();
  const reorder = useReorderMilestone(goalId);
  const setWeight = useSetMilestoneWeight(goalId);
  const setStatus = useSetMilestoneStatus(goalId);
  const createMilestone = useCreateMilestone(goalId);
  const addTask = useAddMilestoneTask(goalId);
  const logProgress = useLogProgress(goalId);

  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [promptFor, setPromptFor] = useState<string | null>(null);
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);

  if (goal.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="bc-card bc-skeleton h-36" />
        <div className="bc-card bc-skeleton h-24" />
        <div className="bc-card bc-skeleton h-24" />
      </div>
    );
  }
  if (goal.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <section className="bc-card">
          <p className="bc-section-label">Couldn&apos;t load this goal</p>
          <p className="bc-label mt-2">{goal.error.message}</p>
        </section>
      </div>
    );
  }

  const data = goal.data;
  const metric = data.progressMode === "METRIC";
  const findMilestone = (id: string | null) => (id === null ? null : (data.milestones.find((m) => m.id === id) ?? null));
  const actionsMilestone = findMilestone(actionsFor);
  // Show the prompt only while it's still true (unchecking a task hides it).
  const prompt = findMilestone(promptFor);
  const showPrompt = prompt !== null && isReadyToClose(prompt);

  const toggleTask = (task: DayTask, milestone?: MilestoneDetail) => {
    const direction = task.status === "DONE" ? "uncomplete" : "complete";
    // Decided before the cache changes: was this the milestone's last open task?
    const closesMilestone = milestone !== undefined && direction === "complete" && isLastOpenTask(milestone, task.id);
    setNotice(null);
    complete.mutate(
      { taskId: task.id, direction },
      {
        onSuccess: (result) => {
          if (closesMilestone && milestone !== undefined && result.milestone?.status === "OPEN") setPromptFor(milestone.id);
        },
        onError: (error) => setNotice(error.message),
      },
    );
  };

  const changeStatus = (milestone: MilestoneDetail, status: "OPEN" | "DONE") => {
    setActionsFor(null);
    setPromptFor(null);
    setStatus.mutate({ milestoneId: milestone.id, status }, { onError: (error) => setNotice(error.message) });
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <BackLink />

      <GoalHeader goal={data} onLogProgress={metric ? () => setLogOpen(true) : undefined} />

      {notice !== null && (
        <div role="alert" className="flex items-start gap-2 rounded-[14px] bg-bc-orange-light py-1 pr-1 pl-4 text-bc-orange-dark">
          <p className="flex-1 py-2.5 text-[14px] font-medium">{notice}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <Icon icon="close" size={18} />
          </button>
        </div>
      )}

      <section aria-labelledby="milestones-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="milestones-heading" className="bc-section-label">
            Milestones
          </h2>
          <button
            type="button"
            onClick={() => {
              createMilestone.reset();
              setAddMilestoneOpen(true);
            }}
            className="bc-btn-secondary min-h-11 px-4"
          >
            <Icon icon="add" size={18} />
            Milestone
          </button>
        </div>
        {data.milestones.length === 0 ? (
          <p className="bc-card bc-label">
            {metric
              ? "Optional for metric goals. Add milestones to mark checkpoints along the way."
              : "Break this goal into 2 to 5 milestones. Each one gets its own tasks."}
          </p>
        ) : (
          <MilestoneList
            milestones={data.milestones}
            color={data.color}
            addingTaskTo={addingTaskTo}
            onOpenActions={(m) => setActionsFor(m.id)}
            onReorder={(milestoneId, rank) =>
              reorder.mutate({ milestoneId, rank }, { onError: (error) => setNotice(error.message) })
            }
            onReorderError={setNotice}
            onToggleTask={toggleTask}
            onAddTask={(milestone, title, clear) => {
              setAddingTaskTo(milestone.id);
              addTask.mutate(
                { milestoneId: milestone.id, title },
                {
                  onSuccess: clear,
                  onError: (error) => setNotice(error.message),
                  onSettled: () => setAddingTaskTo(null),
                },
              );
            }}
            onMarkComplete={(m) => changeStatus(m, "DONE")}
          />
        )}
      </section>

      {(metric || data.looseTasks.length > 0) && (
        <section aria-labelledby="log-heading" className="flex flex-col gap-3">
          <h2 id="log-heading" className="bc-section-label">
            {metric ? "Progress log" : "Other tasks"}
          </h2>
          <div className="bc-card px-1 py-1">
            {data.looseTasks.length === 0 ? (
              <p className="bc-label px-3 py-2">Nothing logged yet. Use Log progress after a run, a chapter, a deposit.</p>
            ) : (
              <ul>
                {data.looseTasks.map((task) => (
                  <TaskCheckRow
                    key={task.id}
                    task={task}
                    color={data.color}
                    unit={data.metricUnit}
                    strikeDone={!metric}
                    onToggle={(t) => toggleTask(t)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="reflections-heading" className="flex flex-col gap-3">
        <h2 id="reflections-heading" className="bc-section-label">
          Reflections
        </h2>
        <ReflectionsList goalId={goalId} color={data.color} />
      </section>

      {showPrompt && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(64px+var(--safe-bottom)+12px)] z-40 mx-auto flex max-w-md items-center gap-2 rounded-[16px] bg-fg py-2 pr-2 pl-4 text-white shadow-card-hover md:bottom-6"
        >
          <p className="min-w-0 flex-1 text-[14px]">
            <span className="font-semibold">All tasks done.</span> Mark milestone complete?
          </p>
          <button
            type="button"
            onClick={() => setPromptFor(null)}
            className="min-h-11 shrink-0 rounded-[10px] px-3 text-[14px] text-white/70"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => changeStatus(prompt, "DONE")}
            className="min-h-11 shrink-0 rounded-[10px] bg-white px-3 text-[14px] font-semibold text-fg"
          >
            Mark complete
          </button>
        </div>
      )}

      <MilestoneActionsSheet
        milestone={actionsMilestone}
        onOpenChange={(open) => {
          if (!open) setActionsFor(null);
        }}
        onWeight={(milestone, weight) =>
          setWeight.mutate({ milestoneId: milestone.id, weight }, { onError: (error) => setNotice(error.message) })
        }
        onStatus={changeStatus}
      />

      <AddMilestoneSheet
        open={addMilestoneOpen}
        onOpenChange={setAddMilestoneOpen}
        pending={createMilestone.isPending}
        error={createMilestone.error?.message ?? null}
        onSubmit={(values) => createMilestone.mutate(values, { onSuccess: () => setAddMilestoneOpen(false) })}
      />

      {metric && (
        <LogProgressSheet
          open={logOpen}
          onOpenChange={(open) => {
            if (open) logProgress.reset();
            setLogOpen(open);
          }}
          unit={data.metricUnit ?? ""}
          current={data.metricCurrent}
          target={data.metricTarget}
          pending={logProgress.isPending}
          error={logProgress.error?.message ?? null}
          onSubmit={(values) => logProgress.mutate(values, { onSuccess: () => setLogOpen(false) })}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/goals"
      className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-full pr-3 pl-1 text-[15px] font-medium text-bc-blue"
    >
      <Icon icon="previous" size={20} />
      Goals
    </Link>
  );
}
