"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatDuration } from "@/lib/domain/day-lists";
import { minutesToLabel } from "@/lib/domain/dates";
import type { DayTask } from "@/lib/domain/goal-tree";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

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
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `row:${task.id}`,
    data: { type: "backlog-task", task },
    disabled: !dragEnabled,
  });
  const done = task.status === "DONE";
  const accent = goalColor ?? "var(--color-fg-tertiary)";
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
        "flex min-h-14 items-center gap-1 pr-3",
        dragEnabled && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-40",
        selected && "bg-bc-blue-light/60 shadow-[inset_3px_0_0_var(--color-bc-blue)]",
      )}
    >
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
      <div className="min-w-0 flex-1 py-2">
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
      </div>
      {task.durationMin !== null && (
        <span className="bc-pill shrink-0 bg-surface-alt text-fg-secondary">{formatDuration(task.durationMin)}</span>
      )}
    </li>
  );
}
