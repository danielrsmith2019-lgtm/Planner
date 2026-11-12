"use client";

import type { DayTask } from "@/lib/domain/goal-tree";
import { formatDayLabel } from "@/lib/domain/dates";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

/** A task with a 44px checkbox. Checking runs useCompleteTask through onToggle. */
export default function TaskCheckRow({
  task,
  color,
  unit,
  strikeDone = true,
  onToggle,
}: {
  task: DayTask;
  color: string;
  /** Metric unit, to show a task's contribution ("+8 km"). */
  unit?: string | null;
  /** Log entries stay readable when done; regular tasks are struck through. */
  strikeDone?: boolean;
  onToggle: (task: DayTask) => void;
}) {
  const done = task.status === "DONE";
  const skipped = task.status === "SKIPPED";
  const meta = [
    task.scheduledDate === null ? "Backlog" : formatDayLabel(task.scheduledDate, { short: true }),
    task.contribution === null ? null : `+${task.contribution} ${unit ?? ""}`.trim(),
    skipped ? "Skipped" : null,
  ].filter((part): part is string => part !== null);

  return (
    <li className="flex items-center gap-1">
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
          style={{ borderColor: color, background: done ? color : "transparent" }}
        >
          {done && <Icon icon="complete" size={13} strokeWidth={3} className="text-white" />}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-1.5">
        <p className={cn("truncate text-[15px]", (done && strikeDone) || skipped ? "text-fg-tertiary line-through" : "text-fg")}>
          {task.title}
        </p>
        <p className="bc-caption truncate">{meta.join(" · ")}</p>
      </div>
    </li>
  );
}
