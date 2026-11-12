"use client";

import { useState } from "react";
import BottomSheet from "@/components/shared/BottomSheet";
import { formatDuration } from "@/lib/domain/day-lists";
import { addDays, formatDayLabel, minutesToLabel, type LocalDate } from "@/lib/domain/dates";
import type { DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { dayHeader, weekDates } from "@/lib/domain/week";
import { cn } from "@/utils/cn";

/**
 * A task's sheet on the week view: what it is, "Move to..." (any day this
 * week, next Monday, or a picked date) and mark done / not done.
 */
export default function WeekTaskSheet({
  task,
  weekStart,
  goals,
  onOpenChange,
  onMove,
  onToggleDone,
}: {
  task: DayTask | null;
  weekStart: LocalDate;
  goals: GoalNode[];
  onOpenChange: (open: boolean) => void;
  onMove: (task: DayTask, toDate: LocalDate) => void;
  onToggleDone: (task: DayTask) => void;
}) {
  const [picked, setPicked] = useState("");
  const goal = task?.goalId == null ? undefined : goals.find((g) => g.id === task.goalId);
  const milestone = goal?.milestones.find((m) => m.id === task?.milestoneId);
  const nextMonday = addDays(weekStart, 7);
  const done = task?.status === "DONE";

  return (
    <BottomSheet
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) setPicked("");
        onOpenChange(open);
      }}
      title={task?.title ?? "Task"}
      primaryAction={task === null ? undefined : { label: done ? "Mark not done" : "Mark done", onClick: () => onToggleDone(task) }}
    >
      {task !== null && (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
            <dt className="text-fg-secondary">Day</dt>
            <dd className="text-fg">{task.scheduledDate === null ? "Backlog" : formatDayLabel(task.scheduledDate)}</dd>
            {task.startMin !== null && (
              <>
                <dt className="text-fg-secondary">Time</dt>
                <dd className="text-fg">{minutesToLabel(task.startMin)}</dd>
              </>
            )}
            {task.durationMin !== null && (
              <>
                <dt className="text-fg-secondary">Duration</dt>
                <dd className="text-fg">{formatDuration(task.durationMin)}</dd>
              </>
            )}
            <dt className="text-fg-secondary">Goal</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-fg">
              {goal !== undefined && <span className="size-2 shrink-0 rounded-full" style={{ background: goal.color }} aria-hidden="true" />}
              <span className="truncate">{goal === undefined ? "None" : milestone === undefined ? goal.title : `${goal.title} / ${milestone.title}`}</span>
            </dd>
          </dl>

          <fieldset className="flex flex-col gap-2">
            <legend className="bc-label mb-2 text-fg">Move to...</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {weekDates(weekStart).map((date) => {
                const header = dayHeader(date);
                const current = date === task.scheduledDate;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={current}
                    aria-current={current ? "date" : undefined}
                    onClick={() => onMove(task, date)}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-[10px] text-[12px] font-semibold",
                      current ? "bg-bc-blue text-white" : "bg-surface-alt text-fg-secondary hover:text-fg",
                    )}
                  >
                    {header.weekday}
                    <span className="bc-data text-[15px]">{header.day}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onMove(task, nextMonday)}
                className="flex min-h-12 flex-col items-center justify-center rounded-[10px] bg-surface-alt text-[12px] font-semibold text-fg-secondary hover:text-fg"
              >
                Next
                <span className="text-[12px]">week</span>
              </button>
            </div>
            <div className="mt-1 flex gap-2">
              <input
                type="date"
                aria-label="Pick a date"
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                className="bc-input min-h-11 flex-1 text-[16px]"
              />
              <button
                type="button"
                disabled={picked === "" || picked === task.scheduledDate}
                onClick={() => onMove(task, picked)}
                className="bc-btn-secondary min-h-11 px-4 disabled:opacity-40"
              >
                Move
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </BottomSheet>
  );
}
