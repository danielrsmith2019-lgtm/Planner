import { describe, expect, it } from "vitest";
import { DEFAULT_DURATION_MIN, computeAlignment, type AlignmentTask } from "./alignment";

const task = (overrides: Partial<AlignmentTask>): AlignmentTask => ({
  goalId: null,
  startMin: 480,
  durationMin: 30,
  isTopThree: false,
  status: "TODO",
  ...overrides,
});

describe("computeAlignment", () => {
  it("is null when nothing is planned", () => {
    expect(computeAlignment({ tasks: [] })).toBeNull();
  });

  it("is null when the only tasks are unscheduled and not Top 3", () => {
    expect(computeAlignment({ tasks: [task({ startMin: null, goalId: "g1" })] })).toBeNull();
  });

  it("is null when every planned task has zero minutes", () => {
    expect(computeAlignment({ tasks: [task({ durationMin: 0, goalId: "g1" })] })).toBeNull();
  });

  it("is goal-linked minutes over total scheduled minutes", () => {
    const tasks = [task({ goalId: "g1", durationMin: 60 }), task({ goalId: null, durationMin: 60 })];
    expect(computeAlignment({ tasks })).toBe(0.5);
  });

  it("is 1 when every planned minute is goal-linked", () => {
    expect(computeAlignment({ tasks: [task({ goalId: "g1", durationMin: 45 })] })).toBe(1);
  });

  it("is 0 when planned time exists but none of it is linked", () => {
    expect(computeAlignment({ tasks: [task({ durationMin: 90 })] })).toBe(0);
  });

  it("counts unscheduled Top 3 tasks at their durationMin", () => {
    const tasks = [
      task({ goalId: null, durationMin: 60 }), // scheduled, unlinked
      task({ goalId: "g1", startMin: null, isTopThree: true, durationMin: 60 }), // Top 3, not time-blocked
    ];
    expect(computeAlignment({ tasks })).toBe(0.5);
  });

  it("does not double count a Top 3 task that is also scheduled", () => {
    const tasks = [task({ goalId: "g1", isTopThree: true, durationMin: 30 }), task({ durationMin: 30 })];
    expect(computeAlignment({ tasks })).toBe(0.5);
  });

  it("ignores unscheduled tasks that are not Top 3", () => {
    const tasks = [task({ goalId: "g1", durationMin: 30 }), task({ startMin: null, durationMin: 600 })];
    expect(computeAlignment({ tasks })).toBe(1);
  });

  it("excludes skipped tasks but keeps done ones", () => {
    const tasks = [
      task({ goalId: "g1", durationMin: 30, status: "DONE" }),
      task({ durationMin: 30 }),
      task({ goalId: "g1", durationMin: 300, status: "SKIPPED" }),
    ];
    expect(computeAlignment({ tasks })).toBe(0.5);
  });

  it(`counts a missing duration as ${DEFAULT_DURATION_MIN} minutes`, () => {
    const tasks = [task({ goalId: "g1", durationMin: null }), task({ durationMin: 90 })];
    expect(computeAlignment({ tasks })).toBe(0.25);
  });

  it("only counts goals in activeGoalIds when given", () => {
    const tasks = [task({ goalId: "active", durationMin: 30 }), task({ goalId: "paused", durationMin: 30 })];
    expect(computeAlignment({ tasks, activeGoalIds: new Set(["active"]) })).toBe(0.5);
    expect(computeAlignment({ tasks })).toBe(1);
  });
});
