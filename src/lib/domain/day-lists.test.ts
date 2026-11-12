import { describe, expect, it } from "vitest";
import { formatDuration, hasTopThreeRoom, splitDayTasks, splitForTimeline } from "./day-lists";
import type { DayTask } from "./goal-tree";

const t = (id: string, o: Partial<DayTask> = {}): DayTask => ({
  id,
  goalId: null,
  milestoneId: null,
  title: id,
  notes: null,
  status: "TODO",
  isTopThree: false,
  scheduledDate: "2026-11-12",
  startMin: null,
  durationMin: 30,
  contribution: null,
  rank: id,
  carryCount: 0,
  completedAt: null,
  ...o,
});

describe("splitDayTasks", () => {
  it("puts flagged tasks in Top 3 and orders the rest by start time then rank", () => {
    const { topThree, rest } = splitDayTasks([
      t("c", { startMin: 600 }),
      t("a"),
      t("top2", { isTopThree: true }),
      t("b", { startMin: 480 }),
      t("top1", { isTopThree: true, startMin: 900 }),
      t("d"),
    ]);
    expect(topThree.map((x) => x.id)).toEqual(["top1", "top2"]);
    expect(rest.map((x) => x.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("caps Top 3 at three and hides skipped tasks", () => {
    const { topThree, rest } = splitDayTasks([
      t("1", { isTopThree: true }),
      t("2", { isTopThree: true }),
      t("3", { isTopThree: true }),
      t("4", { isTopThree: true }),
      t("x", { status: "SKIPPED" }),
    ]);
    expect(topThree.map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(rest.map((x) => x.id)).toEqual(["4"]);
  });
});

describe("hasTopThreeRoom", () => {
  it("ignores skipped tasks", () => {
    const flagged = [t("1", { isTopThree: true }), t("2", { isTopThree: true })];
    expect(hasTopThreeRoom(flagged)).toBe(true);
    expect(hasTopThreeRoom([...flagged, t("3", { isTopThree: true })])).toBe(false);
    expect(hasTopThreeRoom([...flagged, t("3", { isTopThree: true, status: "SKIPPED" })])).toBe(true);
  });
});

describe("formatDuration", () => {
  it("formats minutes", () => {
    expect([15, 60, 90, 120].map(formatDuration)).toEqual(["15m", "1h", "1h 30m", "2h"]);
  });
});

describe("splitForTimeline", () => {
  it("timed tasks go to the grid (Top 3 included), untimed non-Top 3 tasks to Anytime", () => {
    const lists = splitForTimeline([
      t("late", { startMin: 900 }),
      t("any2"),
      t("top-timed", { isTopThree: true, startMin: 480 }),
      t("top-any", { isTopThree: true }),
      t("any1"),
      t("skipped", { startMin: 600, status: "SKIPPED" }),
    ]);
    expect(lists.topThree.map((x) => x.id)).toEqual(["top-any", "top-timed"]);
    expect(lists.timed.map((x) => x.id)).toEqual(["top-timed", "late"]);
    expect(lists.anytime.map((x) => x.id)).toEqual(["any1", "any2"]);
  });
});
