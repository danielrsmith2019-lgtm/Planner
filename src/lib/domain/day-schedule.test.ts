import { describe, expect, it } from "vitest";
import { applyPlacement, moveSelection, placementOf, selectionOrder } from "./day-schedule";
import type { DayData, DayTask } from "./goal-tree";

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

const day = (): DayData => ({
  date: "2026-11-12",
  tasks: [t("block", { startMin: 540 }), t("top", { isTopThree: true })],
  backlog: [t("someday", { scheduledDate: null, durationMin: null })],
  goalTree: [],
});

describe("applyPlacement", () => {
  it("schedules a backlog task into the day", () => {
    const next = applyPlacement(day(), "someday", { scheduledDate: "2026-11-12", startMin: 450, durationMin: 30 });
    expect(next.backlog).toEqual([]);
    expect(next.tasks.find((x) => x.id === "someday")).toMatchObject({ startMin: 450, durationMin: 30, scheduledDate: "2026-11-12" });
  });

  it("moves and resizes a block, and the previous placement undoes it", () => {
    const before = day();
    const block = before.tasks[0];
    if (block === undefined) throw new Error("fixture");
    const moved = applyPlacement(before, "block", { scheduledDate: "2026-11-12", startMin: 600, durationMin: 60 });
    expect(moved.tasks.find((x) => x.id === "block")).toMatchObject({ startMin: 600, durationMin: 60 });
    const undone = applyPlacement(moved, "block", placementOf(block));
    expect(undone.tasks.find((x) => x.id === "block")).toEqual(block);
  });

  it("sends a task to the backlog (dropping Top 3) or out of this day's view", () => {
    const toBacklog = applyPlacement(day(), "top", { scheduledDate: null, startMin: null, durationMin: 30 });
    expect(toBacklog.backlog.find((x) => x.id === "top")).toMatchObject({ isTopThree: false, scheduledDate: null });
    const elsewhere = applyPlacement(day(), "block", { scheduledDate: "2026-11-13", startMin: null, durationMin: 30 });
    expect(elsewhere.tasks.map((x) => x.id)).toEqual(["top"]);
  });
});

describe("selection", () => {
  it("orders Top 3, Anytime, timeline without duplicates and steps with J/K", () => {
    const order = selectionOrder([[t("a"), t("b")], [t("c")], [t("b"), t("d")]]);
    expect(order).toEqual(["a", "b", "c", "d"]);
    expect(moveSelection(order, null, 1)).toBe("a");
    expect(moveSelection(order, null, -1)).toBe("d");
    expect(moveSelection(order, "b", 1)).toBe("c");
    expect(moveSelection(order, "d", 1)).toBe("d");
    expect(moveSelection(order, "a", -1)).toBe("a");
    expect(moveSelection([], "a", 1)).toBeNull();
  });
});
