import { describe, expect, it } from "vitest";
import { STALLED_WINDOW_DAYS, isStalled, type StalledTask } from "./stalled";

const today = "2026-11-09";
const goal = { id: "g1", status: "ACTIVE" as const };
const task = (scheduledDate: string | null, status: StalledTask["status"] = "TODO", goalId = "g1"): StalledTask => ({
  goalId,
  status,
  scheduledDate,
});

describe("isStalled", () => {
  it("uses a 7-day window", () => {
    expect(STALLED_WINDOW_DAYS).toBe(7);
  });

  it("is true for an active goal with no tasks", () => {
    expect(isStalled(goal, [], today)).toBe(true);
  });

  it("is false with a TODO task scheduled today", () => {
    expect(isStalled(goal, [task("2026-11-09")], today)).toBe(false);
  });

  it("is false with a TODO task on today + 7 (inclusive)", () => {
    expect(isStalled(goal, [task("2026-11-16")], today)).toBe(false);
  });

  it("is true when the next TODO task is on today + 8", () => {
    expect(isStalled(goal, [task("2026-11-17")], today)).toBe(true);
  });

  it("is true when the only TODO task is overdue", () => {
    expect(isStalled(goal, [task("2026-11-08")], today)).toBe(true);
  });

  it("is true when tasks in the window are already done or skipped", () => {
    expect(isStalled(goal, [task("2026-11-10", "DONE"), task("2026-11-11", "SKIPPED")], today)).toBe(true);
  });

  it("is true when the goal's only TODO tasks are in the backlog", () => {
    expect(isStalled(goal, [task(null)], today)).toBe(true);
  });

  it("ignores tasks that belong to another goal", () => {
    expect(isStalled(goal, [task("2026-11-10", "TODO", "other")], today)).toBe(true);
  });

  it("is never true for a goal that isn't ACTIVE", () => {
    expect(isStalled({ id: "g1", status: "PAUSED" }, [], today)).toBe(false);
    expect(isStalled({ id: "g1", status: "COMPLETED" }, [], today)).toBe(false);
    expect(isStalled({ id: "g1", status: "ARCHIVED" }, [], today)).toBe(false);
  });

  it("handles a window that crosses a month end", () => {
    expect(isStalled(goal, [task("2026-12-02")], "2026-11-28")).toBe(false);
  });
});
