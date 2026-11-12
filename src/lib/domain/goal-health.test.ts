import { describe, expect, it } from "vitest";
import { computeGoalHealth, healthRank, pickNextStep, sortByHealth, type HealthGoal } from "./goal-health";

const TODAY = "2026-01-06";
// 10-day window, halfway on TODAY.
const goal = (patch: Partial<HealthGoal> = {}): HealthGoal => ({
  id: "g1",
  status: "ACTIVE",
  progress: 0.5,
  startDate: "2026-01-01",
  targetDate: "2026-01-11",
  ...patch,
});
const scheduled = (date: string | null, status: "TODO" | "DONE" | "SKIPPED" = "TODO") => ({
  goalId: "g1",
  status,
  scheduledDate: date,
});

describe("computeGoalHealth", () => {
  it("returns pace, expected progress and stalled together", () => {
    expect(computeGoalHealth(goal(), [scheduled("2026-01-08")], TODAY)).toEqual({
      pace: "on_track",
      expectedProgress: 0.5,
      isStalled: false,
    });
  });

  it("is stalled with no TODO task in the next 7 days", () => {
    const health = computeGoalHealth(goal({ progress: 0.2 }), [scheduled("2026-01-20"), scheduled(null)], TODAY);
    expect(health).toEqual({ pace: "behind", expectedProgress: 0.5, isStalled: true });
  });

  it("has no pace without a target date, but can still be stalled", () => {
    expect(computeGoalHealth(goal({ targetDate: null }), [], TODAY)).toEqual({
      pace: null,
      expectedProgress: null,
      isStalled: true,
    });
  });

  it("gives non-active goals no pace and never stalls them", () => {
    for (const status of ["PAUSED", "COMPLETED", "ARCHIVED"] as const) {
      expect(computeGoalHealth(goal({ status }), [], TODAY)).toEqual({
        pace: null,
        expectedProgress: null,
        isStalled: false,
      });
    }
  });
});

describe("sortByHealth", () => {
  it("orders stalled, behind, on track, ahead, then no pace", () => {
    const goals = [
      { id: "ahead", pace: "ahead" as const, isStalled: false },
      { id: "none", pace: null, isStalled: false },
      { id: "on", pace: "on_track" as const, isStalled: false },
      { id: "stalled", pace: "ahead" as const, isStalled: true },
      { id: "behind", pace: "behind" as const, isStalled: false },
    ];
    expect(sortByHealth(goals).map((g) => g.id)).toEqual(["stalled", "behind", "on", "ahead", "none"]);
  });

  it("keeps rank order between goals with the same health and doesn't mutate the input", () => {
    const goals = [
      { id: "a", pace: "on_track" as const, isStalled: false },
      { id: "b", pace: "behind" as const, isStalled: true },
      { id: "c", pace: "on_track" as const, isStalled: false },
      { id: "d", pace: null, isStalled: true },
    ];
    expect(sortByHealth(goals).map((g) => g.id)).toEqual(["b", "d", "a", "c"]);
    expect(goals.map((g) => g.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("ranks stalled above every pace", () => {
    expect(healthRank({ pace: "ahead", isStalled: true })).toBeLessThan(healthRank({ pace: "behind", isStalled: false }));
  });
});

describe("pickNextStep", () => {
  const m = (id: string, status: "OPEN" | "DONE", tasks: { id: string; status: "TODO" | "DONE" | "SKIPPED" }[]) => ({
    id,
    title: `Milestone ${id}`,
    status,
    tasks,
  });

  it("takes the first TODO task of the first open milestone", () => {
    const step = pickNextStep([
      m("m1", "DONE", [{ id: "t0", status: "TODO" }]),
      m("m2", "OPEN", [
        { id: "t1", status: "DONE" },
        { id: "t2", status: "TODO" },
        { id: "t3", status: "TODO" },
      ]),
      m("m3", "OPEN", [{ id: "t4", status: "TODO" }]),
    ]);
    expect(step).toEqual({ kind: "task", taskId: "t2", milestoneId: "m2" });
  });

  it("asks for a new task in the first open milestone when it has no TODO task", () => {
    const step = pickNextStep([
      m("m1", "OPEN", [{ id: "t1", status: "SKIPPED" }]),
      m("m2", "OPEN", [{ id: "t2", status: "TODO" }]),
    ]);
    expect(step).toEqual({ kind: "create", milestone: { id: "m1", title: "Milestone m1" } });
  });

  it("asks for a new task on the goal when no milestone is open", () => {
    expect(pickNextStep([m("m1", "DONE", [])])).toEqual({ kind: "create", milestone: null });
    expect(pickNextStep([])).toEqual({ kind: "create", milestone: null });
  });
});
