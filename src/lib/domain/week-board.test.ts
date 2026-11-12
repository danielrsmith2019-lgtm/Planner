import { describe, expect, it } from "vitest";
import type { DayTask } from "./goal-tree";
import { rankAfter } from "./rank";
import { applyWeekMove, dayStats, planMoveToEnd, planWeekMove, type WeekData } from "./week-board";
import { weekDates } from "./week";

const r0 = rankAfter(null);
const r1 = rankAfter(r0);
const r2 = rankAfter(r1);

const t = (id: string, date: string, rank: string, o: Partial<DayTask> = {}): DayTask => ({
  id,
  goalId: null,
  milestoneId: null,
  title: id,
  notes: null,
  status: "TODO",
  isTopThree: false,
  scheduledDate: date,
  startMin: null,
  durationMin: 30,
  contribution: null,
  rank,
  carryCount: 0,
  completedAt: null,
  ...o,
});

const MON = "2026-11-09";
const TUE = "2026-11-10";

const week = (): WeekData => ({
  startDate: MON,
  days: weekDates(MON).map((date) => ({
    date,
    tasks:
      date === MON
        ? [t("a", MON, r0), t("b", MON, r1), t("c", MON, r2)]
        : date === TUE
          ? [t("x", TUE, r0), t("y", TUE, r1)]
          : [],
  })),
  goalTree: [],
});

const ids = (w: WeekData, date: string) => w.days.find((d) => d.date === date)?.tasks.map((x) => x.id);

describe("planWeekMove", () => {
  it("reorders within a column: dragging down lands after the over task, up lands before", () => {
    const down = planWeekMove(week(), "a", MON, "b");
    expect(down).not.toBeNull();
    if (down !== null) expect(ids(applyWeekMove(week(), down), MON)).toEqual(["b", "a", "c"]);
    const up = planWeekMove(week(), "c", MON, "a");
    if (up !== null) expect(ids(applyWeekMove(week(), up), MON)).toEqual(["c", "a", "b"]);
    expect(planWeekMove(week(), "a", MON, "a")).toBeNull();
  });

  it("moves to another column before the over task, or to the end over the column", () => {
    const before = planWeekMove(week(), "b", TUE, "y");
    if (before === null) throw new Error("expected a move");
    const moved = applyWeekMove(week(), before);
    expect(ids(moved, TUE)).toEqual(["x", "b", "y"]);
    expect(ids(moved, MON)).toEqual(["a", "c"]);
    expect(moved.days[1].tasks[1].scheduledDate).toBe(TUE);

    const end = planWeekMove(week(), "a", "2026-11-12", null);
    if (end === null) throw new Error("expected a move");
    expect(ids(applyWeekMove(week(), end), "2026-11-12")).toEqual(["a"]);
  });

  it("Move to... appends to the end of the day", () => {
    const move = planMoveToEnd(week(), "a", TUE);
    if (move === null) throw new Error("expected a move");
    expect(ids(applyWeekMove(week(), move), TUE)).toEqual(["x", "y", "a"]);
    expect(planMoveToEnd(week(), "a", MON)).toBeNull();
  });
});

describe("dayStats", () => {
  it("counts done/total and computes alignment against active goals", () => {
    const stats = dayStats(
      {
        date: MON,
        tasks: [
          t("1", MON, r0, { status: "DONE", goalId: "g1", startMin: 480, durationMin: 60 }),
          t("2", MON, r1, { startMin: 600, durationMin: 60 }),
          t("3", MON, r2, { status: "SKIPPED", goalId: "g1", startMin: 700 }),
        ],
      },
      [
        {
          id: "g1",
          title: "G",
          color: "#34C759",
          status: "ACTIVE",
          progressMode: "MILESTONES",
          metricUnit: null,
          metricTarget: null,
          metricCurrent: 0,
          progress: 0,
          pace: null,
          expectedProgress: null,
          isStalled: false,
          milestones: [],
        },
      ],
    );
    expect(stats).toEqual({ done: 1, total: 2, alignment: 0.5 });
  });
});
