import { describe, expect, it } from "vitest";
import { freeGoalColors, GOAL_COLORS } from "./goal-colors";
import { canActivate, goalStatusActions, groupGoalsByStatus } from "./goal-status";
import type { GoalStatus } from "./stalled";

const goal = (id: string, status: GoalStatus, color: string = GOAL_COLORS[0]) => ({ id, status, color });

describe("goalStatusActions", () => {
  it("offers pause/complete/archive for active goals and resume for paused ones", () => {
    expect(goalStatusActions("ACTIVE").map((a) => a.to)).toEqual(["PAUSED", "COMPLETED", "ARCHIVED"]);
    expect(goalStatusActions("PAUSED").map((a) => a.to)).toEqual(["ACTIVE", "COMPLETED", "ARCHIVED"]);
    expect(goalStatusActions("COMPLETED").map((a) => a.label)).toEqual(["Reopen", "Archive"]);
  });
});

describe("canActivate", () => {
  it("is false at 5 active goals, ignoring paused and completed", () => {
    const four = ["a", "b", "c", "d"].map((id) => goal(id, "ACTIVE"));
    expect(canActivate([...four, goal("p", "PAUSED"), goal("c2", "COMPLETED")])).toBe(true);
    expect(canActivate([...four, goal("e", "ACTIVE")])).toBe(false);
  });
});

describe("freeGoalColors", () => {
  it("drops colors used by active goals only, keeping the edited goal's own", () => {
    const goals = [goal("a", "ACTIVE", GOAL_COLORS[0]), goal("b", "PAUSED", GOAL_COLORS[1]), goal("c", "ACTIVE", GOAL_COLORS[2])];
    expect(freeGoalColors(goals).map((c) => c.base)).toEqual([GOAL_COLORS[1], GOAL_COLORS[3], GOAL_COLORS[4]]);
    expect(freeGoalColors(goals, "a").map((c) => c.token)).toEqual(["--color-goal-1", "--color-goal-2", "--color-goal-4", "--color-goal-5"]);
  });
});

describe("groupGoalsByStatus", () => {
  it("orders sections Active, Paused, Completed and skips empty ones", () => {
    const sections = groupGoalsByStatus([goal("c", "COMPLETED"), goal("a", "ACTIVE"), goal("a2", "ACTIVE")]);
    expect(sections.map((s) => [s.status, s.goals.length])).toEqual([
      ["ACTIVE", 2],
      ["COMPLETED", 1],
    ]);
  });
});
