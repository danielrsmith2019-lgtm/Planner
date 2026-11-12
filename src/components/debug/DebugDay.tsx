"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import GoalRing from "@/components/shared/GoalRing";
import { minutesToLabel, type LocalDate } from "@/lib/domain/dates";
import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { useCompleteTask } from "@/hooks/useCompleteTask";
import { dayQuery } from "@/queries/day";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";

/**
 * Temporary (Day 10) page for the data layer: the selected day's tasks with
 * a complete button, each task's goal %, and the last server delta. Use the
 * header arrows to move between days.
 */
export default function DebugDay() {
  const date = useUiStore((s) => s.selectedDate);
  if (date === null) return <div className="bc-card bc-skeleton h-40" aria-hidden="true" />;
  return <DebugDayFor date={date} />;
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const signedPercent = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;

type LastChange = { title: string; goal: string; optimistic: number; server: number | null; error: string | null };

function DebugDayFor({ date }: { date: LocalDate }) {
  const day = useQuery(dayQuery(date));
  const complete = useCompleteTask(date);
  const [last, setLast] = useState<LastChange | null>(null);

  if (day.isPending) return <div className="bc-card bc-skeleton h-40" aria-hidden="true" />;
  if (day.isError) {
    return (
      <section className="bc-card">
        <p className="bc-section-label">Couldn&apos;t load the day</p>
        <p className="bc-label mt-2">{day.error.message}</p>
      </section>
    );
  }

  const data = day.data;
  const goalsById = new Map(data.goalTree.map((g) => [g.id, g]));

  const toggle = (task: DayTask) => {
    const goal = task.goalId === null ? undefined : goalsById.get(task.goalId);
    const direction = task.status === "DONE" ? "uncomplete" : "complete";
    complete.mutate(
      { taskId: task.id, direction },
      {
        // onMutateResult is what onMutate returned: the client's prediction.
        onSuccess: (result, _variables, onMutateResult) =>
          setLast({
            title: task.title,
            goal: goal?.title ?? "No goal",
            optimistic: onMutateResult?.optimisticDelta ?? 0,
            server: result.delta,
            error: null,
          }),
        onError: (error) =>
          setLast({ title: task.title, goal: goal?.title ?? "No goal", optimistic: 0, server: null, error: error.message }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="bc-card flex flex-col gap-1">
        <span className="bc-section-label">Debug: data layer</span>
        <p className="bc-label">
          {data.tasks.length} tasks on {date}. Tap the circle to complete; tap again to undo.
        </p>
        <p className="bc-caption">Pending server calls: {complete.isPending ? "yes" : "none"}{day.isFetching ? ", refetching day" : ""}</p>
      </section>

      {last !== null && (
        <section className="bc-card flex flex-col gap-1" aria-live="polite">
          <span className="bc-section-label">Last change</span>
          <p className="text-[15px] font-semibold text-fg">{last.title}</p>
          {last.error === null ? (
            <p className="bc-label">
              {last.goal}: optimistic {signedPercent(last.optimistic)}, server{" "}
              {last.server === null ? "pending" : signedPercent(last.server)}
              {last.server !== null && Math.abs(last.server - last.optimistic) < 1e-9 ? " (match)" : ""}
            </p>
          ) : (
            <p className="bc-label text-bc-red">Rolled back: {last.error}</p>
          )}
        </section>
      )}

      <GoalStrip goals={data.goalTree} />

      <section className="bc-card-flush overflow-hidden">
        {data.tasks.length === 0 ? (
          <p className="bc-label p-4">No tasks on this day. Run the seed for your account, or move to another day.</p>
        ) : (
          <ul>
            {data.tasks.map((task) => (
              <TaskRow key={task.id} task={task} goal={task.goalId === null ? undefined : goalsById.get(task.goalId)} onToggle={toggle} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GoalStrip({ goals }: { goals: GoalNode[] }) {
  if (goals.length === 0) return null;
  return (
    <section className="bc-card flex gap-4 overflow-x-auto">
      {goals.map((goal) => (
        <GoalRing
          key={goal.id}
          progress={goal.progress}
          color={goal.color}
          size={56}
          label={goal.title}
          sublabel={percent(goal.progress)}
          className="min-w-[72px]"
        />
      ))}
    </section>
  );
}

function TaskRow({
  task,
  goal,
  onToggle,
}: {
  task: DayTask;
  goal: GoalNode | undefined;
  onToggle: (task: DayTask) => void;
}) {
  const done = task.status === "DONE";
  const milestone = goal?.milestones.find((m) => m.id === task.milestoneId);
  return (
    <li className="flex items-center gap-3 border-b border-black/5 px-3 py-2 last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-pressed={done}
        aria-label={done ? `Mark "${task.title}" not done` : `Complete "${task.title}"`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <span
          className="flex size-6 items-center justify-center rounded-full border-2"
          style={{ borderColor: goal?.color ?? "#C7C7CC", background: done ? (goal?.color ?? "#8E8E93") : "transparent" }}
        >
          {done && <Icon icon="complete" size={14} strokeWidth={3} className="text-white" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] font-medium ${done ? "text-fg-tertiary line-through" : "text-fg"}`}>{task.title}</p>
        <p className="bc-caption truncate">
          {task.startMin === null ? "Anytime" : minutesToLabel(task.startMin)}
          {goal === undefined ? " · No goal" : ` · ${goal.title}`}
          {milestone === undefined ? "" : ` / ${milestone.title} ${percent(milestone.progress)}`}
        </p>
      </div>
      {goal !== undefined && (
        <span className="bc-data-mono shrink-0 text-[13px]" style={{ color: goal.color }}>
          {percent(goal.progress)}
        </span>
      )}
    </li>
  );
}
