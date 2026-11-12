"use client";

import { useState } from "react";
import BottomSheet from "@/components/shared/BottomSheet";
import { addDays, formatDayLabel, type LocalDate } from "@/lib/domain/dates";
import type { GoalNode } from "@/lib/domain/goal-tree";
import type { TaskDTO } from "@/services/mappers";
import { cn } from "@/utils/cn";
import { buildCarryOverDecisions, summarizeChoices, type CarryChoice } from "./carry-over";

const ACTIONS: { value: CarryChoice["action"]; label: string }[] = [
  { value: "keep", label: "Today" },
  { value: "reschedule", label: "Later" },
  { value: "drop", label: "Drop" },
];

/**
 * Morning triage for unfinished tasks: for each one, keep it (move to today),
 * reschedule it to a day you pick, or drop it (marked skipped). Everything is
 * applied together through resolveCarryOver, which uses carryOverTasks.
 */
export default function CarryOverSheet({
  open,
  onOpenChange,
  today,
  tasks,
  goals,
  pending,
  error,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: LocalDate;
  tasks: TaskDTO[];
  goals: GoalNode[];
  pending: boolean;
  error: string | null;
  onApply: (decisions: ReturnType<typeof buildCarryOverDecisions>) => void;
}) {
  const [choices, setChoices] = useState<Map<string, CarryChoice>>(new Map());
  // Default for a task with no explicit choice: keep it.
  const choiceFor = (id: string): CarryChoice => choices.get(id) ?? { action: "keep" };
  const all = new Map(tasks.map((t) => [t.id, choiceFor(t.id)]));
  const setChoice = (id: string, choice: CarryChoice) => setChoices((current) => new Map(current).set(id, choice));
  const setAll = (action: "keep" | "drop") => setChoices(new Map(tasks.map((t) => [t.id, { action }])));
  const goalById = new Map(goals.map((g) => [g.id, g]));

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setChoices(new Map());
        onOpenChange(next);
      }}
      title={`${tasks.length} unfinished from earlier`}
      description="Move each one to today, to another day, or drop it."
      primaryAction={{
        label: tasks.length === 0 ? "Done" : summarizeChoices(all),
        onClick: () => onApply(buildCarryOverDecisions(all)),
        disabled: tasks.length === 0,
        pending,
        pendingLabel: "Applying...",
      }}
      footerNote={
        error === null ? undefined : (
          <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
            {error}
          </p>
        )
      }
    >
      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setAll("keep")} className="bc-btn-secondary min-h-11 flex-1">
          All to today
        </button>
        <button type="button" onClick={() => setAll("drop")} className="bc-btn-secondary min-h-11 flex-1">
          Drop all
        </button>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {tasks.map((task) => {
          const choice = choiceFor(task.id);
          const goal = task.goalId === null ? undefined : goalById.get(task.goalId);
          return (
            <li key={task.id} className="flex flex-col gap-2 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: goal?.color ?? "var(--color-fg-tertiary)" }}
                  aria-hidden="true"
                />
                <p className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", choice.action === "drop" ? "text-fg-tertiary line-through" : "text-fg")}>
                  {task.title}
                </p>
                <span className="bc-caption shrink-0">
                  {task.scheduledDate === null ? "" : formatDayLabel(task.scheduledDate, { short: true })}
                </span>
              </div>
              <div role="radiogroup" aria-label={`What to do with ${task.title}`} className="grid grid-cols-3 gap-1 rounded-[12px] bg-surface-alt p-1">
                {ACTIONS.map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    role="radio"
                    aria-checked={choice.action === action.value}
                    onClick={() =>
                      setChoice(
                        task.id,
                        action.value === "reschedule"
                          ? { action: "reschedule", date: addDays(today, 1) }
                          : { action: action.value },
                      )
                    }
                    className={cn(
                      "min-h-11 rounded-[10px] text-[14px] font-semibold transition-colors",
                      choice.action === action.value
                        ? action.value === "drop"
                          ? "bg-surface text-bc-red shadow-card"
                          : "bg-surface text-fg shadow-card"
                        : "text-fg-secondary",
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {choice.action === "reschedule" && (
                <input
                  type="date"
                  aria-label={`New date for ${task.title}`}
                  value={choice.date}
                  min={today}
                  onChange={(e) => setChoice(task.id, { action: "reschedule", date: e.target.value })}
                  className="bc-input min-h-11 text-[16px]"
                />
              )}
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
