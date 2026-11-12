"use client";

import { formatDuration } from "@/lib/domain/day-lists";
import { minutesToLabel } from "@/lib/domain/dates";
import type { DayTask } from "@/lib/domain/goal-tree";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

/** A task on the week view: goal-color left border, title, duration (and time). */
export function WeekTaskCardBody({ task, goalColor }: { task: DayTask; goalColor: string | undefined }) {
  const done = task.status === "DONE";
  const skipped = task.status === "SKIPPED";
  return (
    <div
      className="flex min-h-11 flex-col justify-center rounded-[10px] border border-border border-l-[3px] bg-surface py-1.5 pr-2 pl-2.5 text-left shadow-card"
      style={{ borderLeftColor: goalColor ?? "var(--color-border-strong)" }}
    >
      <p className={cn("line-clamp-2 text-[13px] font-medium leading-snug", done || skipped ? "text-fg-tertiary line-through" : "text-fg")}>
        {done && <Icon icon="complete" size={12} strokeWidth={3} className="mr-1 inline-block align-[-1px] text-bc-green" />}
        {task.title}
      </p>
      {(task.durationMin !== null || task.startMin !== null) && (
        <p className="bc-caption mt-0.5 truncate text-[11px]">
          {[task.startMin === null ? null : minutesToLabel(task.startMin), task.durationMin === null ? null : formatDuration(task.durationMin)]
            .filter((part): part is string => part !== null)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
