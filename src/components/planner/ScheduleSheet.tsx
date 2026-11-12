"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import BottomSheet from "@/components/shared/BottomSheet";
import { DURATION_CHOICES, formatDuration } from "@/lib/domain/day-lists";
import { getLocalMinute, minutesToLabel, type LocalDate } from "@/lib/domain/dates";
import type { Placement } from "@/lib/domain/day-schedule";
import type { DayTask } from "@/lib/domain/goal-tree";
import { dayQuery } from "@/queries/day";
import { cn } from "@/utils/cn";
import {
  initialSchedule,
  nextFreeTodaySchedule,
  resolveStart,
  targetDate,
  toPlacement,
  type ScheduleState,
  type SheetDateChoice,
  type TimeChoice,
} from "./schedule-sheet";

const TIME_CHIPS: { value: TimeChoice; label: string }[] = [
  { value: "next", label: "Next free slot" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "pick", label: "Pick time" },
];

const DATE_CHIPS: { value: SheetDateChoice; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "pick", label: "Pick" },
];

function nowMinute(timezone: string | null): number {
  const now = new Date();
  if (timezone !== null) {
    try {
      return getLocalMinute(timezone, now);
    } catch {
      // Use the browser's clock.
    }
  }
  return now.getHours() * 60 + now.getMinutes();
}

type SheetProps = {
  task: DayTask | null;
  today: LocalDate;
  timezone: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (task: DayTask, placement: Placement) => void;
  /** Timed blocks open this sheet on phones, so it also offers done / not done. */
  onToggleDone?: (task: DayTask) => void;
  /** Open on "Next free slot" today instead of the task's current placement. */
  startAtNextFreeToday?: boolean;
};

/**
 * Tap-to-schedule (blueprint Section 4, "Touch interactions"). Time chips
 * (each shows the slot it would pick), duration chips, date chips, and Save
 * anchored at the bottom by BottomSheet's footer. Free slots come from
 * findNextFreeSlot over the chosen day's blocks.
 */
export default function ScheduleSheet({ task, ...props }: SheetProps) {
  if (task === null) {
    return (
      <BottomSheet open={false} onOpenChange={props.onOpenChange} title="Schedule">
        {null}
      </BottomSheet>
    );
  }
  // Keyed by task, so each opening starts from that task's current placement.
  return <ScheduleForm key={task.id} task={task} {...props} />;
}

function ScheduleForm({
  task,
  today,
  timezone,
  onOpenChange,
  onSave,
  onToggleDone,
  startAtNextFreeToday = false,
}: SheetProps & { task: DayTask }) {
  const [state, setState] = useState<ScheduleState>(() =>
    startAtNextFreeToday ? nextFreeTodaySchedule(task, today) : initialSchedule(task, today),
  );
  const [now] = useState(() => nowMinute(timezone));
  const set = <K extends keyof ScheduleState>(key: K, value: ScheduleState[K]) => setState((s) => ({ ...s, [key]: value }));

  const date = targetDate(state, today);
  const day = useQuery(dayQuery(date));
  const dayTasks = day.data?.tasks ?? [];
  const ctx = { isToday: date === today, nowMin: now, excludeId: task.id };
  const startFor = (time: TimeChoice) => resolveStart({ ...state, time }, dayTasks, ctx);
  const start = resolveStart(state, dayTasks, ctx);
  const placement = toPlacement(state, today, start);
  const summary =
    placement === null || placement.startMin === null
      ? state.time === "pick"
        ? "Pick a time that ends by midnight."
        : `No free ${formatDuration(state.durationMin)} slot left that day.`
      : `${minutesToLabel(placement.startMin)} - ${minutesToLabel((placement.startMin + state.durationMin) % 1440)}`;

  return (
    <BottomSheet
      open
      onOpenChange={onOpenChange}
      title={`Schedule "${task.title}"`}
      primaryAction={{ label: "Save", disabled: placement === null, onClick: () => placement !== null && onSave(task, placement) }}
      footerNote={
        <p className="bc-caption text-center tabular-nums" aria-live="polite">
          {summary}
        </p>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="bc-label mb-2 text-fg">Time</legend>
          <div role="radiogroup" aria-label="Time" className="flex flex-wrap gap-2">
            {TIME_CHIPS.map((chip) => {
              const slot = chip.value === "pick" ? null : startFor(chip.value);
              const selected = state.time === chip.value;
              const unavailable = chip.value !== "pick" && slot === null && !day.isPending;
              return (
                <button
                  key={chip.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={unavailable}
                  onClick={() => set("time", chip.value)}
                  className={cn(
                    "flex min-h-12 flex-col items-start justify-center rounded-[12px] px-3.5 text-left transition-colors disabled:opacity-40",
                    selected ? "bg-bc-blue text-white" : "bg-surface-alt text-fg",
                  )}
                >
                  <span className="text-[14px] font-semibold">{chip.label}</span>
                  {chip.value !== "pick" && (
                    <span className={cn("text-[12px] tabular-nums", selected ? "text-white/80" : "text-fg-secondary")}>
                      {day.isPending ? "..." : slot === null ? "No room" : minutesToLabel(slot)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {state.time === "pick" && (
            <input
              type="time"
              step={900}
              aria-label="Start time"
              value={state.pickedTime}
              onChange={(e) => set("pickedTime", e.target.value)}
              className="bc-input mt-1 min-h-11 text-[16px]"
            />
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="bc-label mb-2 text-fg">Duration</legend>
          <div role="radiogroup" aria-label="Duration" className="flex flex-wrap gap-2">
            {DURATION_CHOICES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={state.durationMin === minutes}
                onClick={() => set("durationMin", minutes)}
                className={cn(
                  "min-h-11 min-w-14 rounded-full px-4 text-[14px] font-semibold transition-colors",
                  state.durationMin === minutes ? "bg-bc-blue text-white" : "bg-surface-alt text-fg-secondary",
                )}
              >
                {formatDuration(minutes)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="bc-label mb-2 text-fg">Day</legend>
          <div role="radiogroup" aria-label="Day" className="grid grid-cols-3 gap-1 rounded-[12px] bg-surface-alt p-1">
            {DATE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                role="radio"
                aria-checked={state.date === chip.value}
                onClick={() => set("date", chip.value)}
                className={cn(
                  "min-h-11 rounded-[10px] text-[14px] font-semibold transition-colors",
                  state.date === chip.value ? "bg-surface text-fg shadow-card" : "text-fg-secondary",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {state.date === "pick" && (
            <input
              type="date"
              aria-label="Date"
              min={today}
              value={state.pickedDate}
              onChange={(e) => set("pickedDate", e.target.value)}
              className="bc-input mt-1 min-h-11 text-[16px]"
            />
          )}
        </fieldset>

        {onToggleDone !== undefined && task.startMin !== null && (
          <button type="button" onClick={() => onToggleDone(task)} className="bc-btn-secondary min-h-11">
            {task.status === "DONE" ? "Mark not done" : "Mark done"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
