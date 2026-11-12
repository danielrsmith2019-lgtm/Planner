import { addDays, labelToMinutes, toDayNumber, type LocalDate } from "@/lib/domain/dates";
import type { Placement } from "@/lib/domain/day-schedule";
import type { DayTask } from "@/lib/domain/goal-tree";
import {
  AFTERNOON_START_MIN,
  DAY_END_MIN,
  EVENING_START_MIN,
  findNextFreeSlot,
  MORNING_START_MIN,
  type SlotTask,
} from "@/lib/domain/slots";

/** ScheduleSheet's pure parts: chip choices -> a placement. */

export type TimeChoice = "next" | "morning" | "afternoon" | "evening" | "pick";
export type SheetDateChoice = "today" | "tomorrow" | "pick";

export type ScheduleState = {
  time: TimeChoice;
  /** "HH:MM" from the native time input. */
  pickedTime: string;
  durationMin: number;
  date: SheetDateChoice;
  pickedDate: LocalDate;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const minutesToInput = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Open on the task's current day and time when it has them; otherwise "Next free slot" today. */
export function initialSchedule(task: DayTask, today: LocalDate): ScheduleState {
  const day = task.scheduledDate ?? today;
  const date: SheetDateChoice = day === today ? "today" : day === addDays(today, 1) ? "tomorrow" : "pick";
  return {
    time: task.startMin === null ? "next" : "pick",
    pickedTime: minutesToInput(task.startMin ?? 9 * 60),
    durationMin: task.durationMin ?? 30,
    date,
    pickedDate: day < today ? today : day,
  };
}

/** "Schedule next step": Next free slot today, keeping the task's duration. */
export function nextFreeTodaySchedule(task: DayTask, today: LocalDate): ScheduleState {
  return { ...initialSchedule(task, today), time: "next", date: "today", pickedDate: today };
}

export function targetDate(state: ScheduleState, today: LocalDate): LocalDate {
  if (state.date === "today") return today;
  if (state.date === "tomorrow") return addDays(today, 1);
  return state.pickedDate;
}

/** Where each chip searches from. "Next free slot" means from now on today, from 8:00 on other days. */
export function searchFrom(choice: Exclude<TimeChoice, "pick">, isToday: boolean, nowMin: number): number {
  switch (choice) {
    case "next":
      return isToday ? nowMin : MORNING_START_MIN;
    case "morning":
      return MORNING_START_MIN;
    case "afternoon":
      return AFTERNOON_START_MIN;
    case "evening":
      return EVENING_START_MIN;
  }
}

/** The start each chip would give, or null when no slot fits (or the picked time is invalid). */
export function resolveStart(
  state: ScheduleState,
  dayTasks: readonly SlotTask[],
  { isToday, nowMin, excludeId }: { isToday: boolean; nowMin: number; excludeId: string },
): number | null {
  if (state.time === "pick") {
    const minutes = labelToMinutes(state.pickedTime);
    return minutes === null || minutes + state.durationMin > DAY_END_MIN ? null : minutes;
  }
  return findNextFreeSlot(dayTasks, state.durationMin, searchFrom(state.time, isToday, nowMin), DAY_END_MIN, excludeId);
}

export function toPlacement(state: ScheduleState, today: LocalDate, startMin: number | null): Placement | null {
  const date = targetDate(state, today);
  try {
    toDayNumber(date);
  } catch {
    return null;
  }
  if (startMin === null) return null;
  return { scheduledDate: date, startMin, durationMin: state.durationMin };
}
