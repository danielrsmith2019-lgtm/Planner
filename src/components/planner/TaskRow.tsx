"use client";

import { useDraggable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { formatDuration } from "@/lib/domain/day-lists";
import { minutesToLabel } from "@/lib/domain/dates";
import type { DayTask } from "@/lib/domain/goal-tree";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import SwipeRow from "./SwipeRow";

/**
 * A task on Today: 44px checkbox, title, goal-color dot, start time when it
 * has one, and a duration pill. The checkbox runs useCompleteTask.
 */
export default function TaskRow({
  task,
  goalColor,
  goalTitle,
  onToggle,
  dragEnabled = false,
  selected = false,
  onOpen,
  onSchedule,
}: {
  task: DayTask;
  /** Undefined for tasks with no goal. */
  goalColor?: string;
  goalTitle?: string;
  onToggle: (task: DayTask) => void;
  /** Desktop: drag the row onto the timeline to give it a time ("backlog-task"). */
  dragEnabled?: boolean;
  /** Highlighted by J/K. */
  selected?: boolean;
  /** Phones: tapping the row (not the checkbox) opens the schedule sheet. */
  onOpen?: (task: DayTask) => void;
  /** Phones: swipe right completes, swipe left calls this (the schedule sheet). */
  onSchedule?: (task: DayTask) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `row:${task.id}`,
    data: { type: "backlog-task", task },
    disabled: !dragEnabled,
  });
  const done = task.status === "DONE";
  const accent = goalColor ?? "var(--color-fg-tertiary)";
  const content = (
    <div className="flex min-h-14 items-center gap-1 pr-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={task.title}
        onClick={() => onToggle(task)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <span
          className="flex size-[22px] items-center justify-center rounded-full border-2 transition-colors"
          style={{ borderColor: accent, background: done ? accent : "transparent" }}
        >
          {done && <Icon icon="complete" size={13} strokeWidth={3} className="text-white" />}
        </span>
      </button>
      <Body
        onOpen={onOpen === undefined ? undefined : () => onOpen(task)}
        label={`Schedule "${task.title}"`}
      >
        <p className={cn("truncate text-[15px]", done ? "text-fg-tertiary line-through" : "text-fg")}>{task.title}</p>
        {(goalTitle !== undefined || task.startMin !== null || task.carryCount > 0) && (
          <p className="bc-caption flex min-w-0 items-center gap-1.5">
            {goalColor !== undefined && (
              <span className="size-2 shrink-0 rounded-full" style={{ background: goalColor }} aria-hidden="true" />
            )}
            <span className="truncate">
              {[
                task.startMin === null ? null : minutesToLabel(task.startMin),
                goalTitle ?? null,
                task.carryCount > 0 ? `Carried ${task.carryCount}x` : null,
              ]
                .filter((part): part is string => part !== null)
                .join(" · ")}
            </span>
          </p>
        )}
      </Body>
      {task.durationMin !== null && (
        <span className="bc-pill shrink-0 bg-surface-alt text-fg-secondary">{formatDuration(task.durationMin)}</span>
      )}
    </div>
  );

  return (
    <li
      ref={setNodeRef}
      // Pointer only: the checkbox inside keeps the keyboard.
      onPointerDown={(event) => {
        const start: unknown = listeners?.onPointerDown;
        if (typeof start === "function") start(event);
      }}
      data-task-id={task.id}
      className={cn(
        dragEnabled && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-40",
        selected && "bg-bc-blue-light/60 shadow-[inset_3px_0_0_var(--color-bc-blue)]",
      )}
    >
      {onSchedule === undefined ? (
        content
      ) : (
        <SwipeRow enabled onSwipeRight={() => onToggle(task)} onSwipeLeft={() => onSchedule(task)}>
          {content}
        </SwipeRow>
      )}
    </li>
  );
}

/** The title area: a full-height button when tapping opens the sheet, plain text otherwise. */
function Body({ onOpen, label, children }: { onOpen?: () => void; label: string; children: ReactNode }) {
  if (onOpen === undefined) return <div className="min-w-0 flex-1 py-2">{children}</div>;
  return (
    <button type="button" onClick={onOpen} aria-label={label} className="min-h-11 min-w-0 flex-1 py-2 text-left">
      {children}
    </button>
  );
}
