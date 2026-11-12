import { describe, expect, it } from "vitest";
import type { DayTask } from "@/lib/domain/goal-tree";
import { initialSchedule, nextFreeTodaySchedule, resolveStart, toPlacement, type ScheduleState } from "./schedule-sheet";

const task = (o: Partial<DayTask> = {}): DayTask => ({
  id: "t",
  goalId: null,
  milestoneId: null,
  title: "Task",
  notes: null,
  status: "TODO",
  isTopThree: false,
  scheduledDate: null,
  startMin: null,
  durationMin: 45,
  contribution: null,
  rank: "i0",
  carryCount: 0,
  completedAt: null,
  ...o,
});

const TODAY = "2026-11-12";
const busy = [
  { id: "a", startMin: 8 * 60, durationMin: 60 },
  { id: "b", startMin: 13 * 60, durationMin: 30 },
  { id: "c", startMin: 15 * 60, durationMin: 60 },
];

describe("schedule sheet", () => {
  it("opens on Next free slot today for a backlog task, or the task's own day and time", () => {
    expect(initialSchedule(task(), TODAY)).toMatchObject({ time: "next", date: "today", durationMin: 45 });
    expect(initialSchedule(task({ scheduledDate: "2026-11-13", startMin: 570 }), TODAY)).toMatchObject({
      time: "pick",
      pickedTime: "09:30",
      date: "tomorrow",
    });
  });

  it("Schedule next step opens on Next free slot today even for a task placed elsewhere", () => {
    expect(nextFreeTodaySchedule(task({ scheduledDate: "2026-12-01", startMin: 570 }), TODAY)).toMatchObject({
      time: "next",
      date: "today",
      pickedDate: TODAY,
      durationMin: 45,
    });
  });

  it("each chip finds the first free slot from its own start", () => {
    const base: ScheduleState = { time: "next", pickedTime: "09:00", durationMin: 45, date: "today", pickedDate: TODAY };
    const ctx = { isToday: true, nowMin: 14 * 60 + 50, excludeId: "t" };
    expect(resolveStart(base, busy, ctx)).toBe(16 * 60); // now 2:50 PM, 3-4 busy
    expect(resolveStart({ ...base, time: "morning" }, busy, ctx)).toBe(9 * 60);
    expect(resolveStart({ ...base, time: "afternoon" }, busy, ctx)).toBe(13 * 60 + 30);
    expect(resolveStart({ ...base, time: "evening" }, busy, ctx)).toBe(18 * 60);
    // Another day: "next" searches from 8:00.
    expect(resolveStart(base, busy, { ...ctx, isToday: false })).toBe(9 * 60);
  });

  it("Pick time uses the native input's HH:MM, and builds the placement", () => {
    const state: ScheduleState = { time: "pick", pickedTime: "07:15", durationMin: 30, date: "tomorrow", pickedDate: TODAY };
    const start = resolveStart(state, busy, { isToday: false, nowMin: 0, excludeId: "t" });
    expect(start).toBe(7 * 60 + 15);
    expect(toPlacement(state, TODAY, start)).toEqual({ scheduledDate: "2026-11-13", startMin: 435, durationMin: 30 });
    expect(toPlacement(state, TODAY, null)).toBeNull();
  });
});
