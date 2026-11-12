import { describe, expect, it } from "vitest";
import { applyServerCompletion, applyTaskCompletion, type DayData, type DayTask } from "./goal-tree";

const NOW = new Date("2026-11-12T16:00:00Z");

const task = (overrides: Partial<DayTask>): DayTask => ({
  id: "t1",
  goalId: "g1",
  milestoneId: "m1",
  title: "Task",
  notes: null,
  status: "TODO",
  isTopThree: false,
  scheduledDate: "2026-11-12",
  startMin: null,
  durationMin: 30,
  contribution: null,
  rank: "a0",
  carryCount: 0,
  completedAt: null,
  ...overrides,
});

// Goal g1 (MILESTONES): m1 weight 1 (1 done of 2), m2 weight 2 (0 of 1).
// Goal g2 (METRIC): 54 of 500 km.
const day = (): DayData => ({
  date: "2026-11-12",
  tasks: [
    task({ id: "t1" }),
    task({ id: "t2", milestoneId: "m2" }),
    task({ id: "run", goalId: "g2", milestoneId: null, contribution: 8 }),
    task({ id: "loose", goalId: null, milestoneId: null }),
    task({ id: "already", status: "DONE", completedAt: NOW }),
  ],
  backlog: [],
  goalTree: [
    {
      id: "g1",
      title: "Portfolio",
      color: "#5856D6",
      status: "ACTIVE",
      progressMode: "MILESTONES",
      metricUnit: null,
      metricTarget: null,
      metricCurrent: 0,
      progress: 0.5 / 3,
      milestones: [
        { id: "m1", title: "Design", status: "OPEN", weight: 1, progress: 0.5, counts: { todo: 1, done: 1, skipped: 0 } },
        { id: "m2", title: "Launch", status: "OPEN", weight: 2, progress: 0, counts: { todo: 1, done: 0, skipped: 0 } },
      ],
    },
    {
      id: "g2",
      title: "Marathon",
      color: "#34C759",
      status: "ACTIVE",
      progressMode: "METRIC",
      metricUnit: "km",
      metricTarget: 500,
      metricCurrent: 54,
      progress: 54 / 500,
      milestones: [],
    },
  ],
});

describe("applyTaskCompletion", () => {
  it("marks the task done, recomputes the milestone (capped at 0.95) and the weighted goal", () => {
    const result = applyTaskCompletion(day(), "t1", "complete", NOW);
    expect(result.changed).toBe(true);
    expect(result.day.tasks[0]).toMatchObject({ status: "DONE", completedAt: NOW });
    const goal = result.day.goalTree[0];
    expect(goal.milestones[0]).toMatchObject({ progress: 0.95, counts: { todo: 0, done: 2, skipped: 0 } });
    expect(goal.progress).toBeCloseTo(0.95 / 3, 12);
    expect(result.delta).toBeCloseTo((0.95 - 0.5) / 3, 12);
    expect(result.goalId).toBe("g1");
  });

  it("adds a metric contribution and recomputes progress", () => {
    const result = applyTaskCompletion(day(), "run", "complete", NOW);
    expect(result.day.goalTree[1]).toMatchObject({ metricCurrent: 62, progress: 62 / 500 });
    expect(result.delta).toBeCloseTo(8 / 500, 12);
  });

  it("uncomplete is the exact inverse", () => {
    const start = day();
    const done = applyTaskCompletion(start, "t1", "complete", NOW);
    const undone = applyTaskCompletion(done.day, "t1", "uncomplete", NOW);
    expect(undone.day).toEqual(start);
    expect(undone.delta).toBeCloseTo(-done.delta, 12);
  });

  it("is a no-op for a task already done, a TODO uncomplete, or a task not in the day", () => {
    const start = day();
    expect(applyTaskCompletion(start, "already", "complete", NOW)).toMatchObject({ changed: false, delta: 0 });
    expect(applyTaskCompletion(start, "t1", "uncomplete", NOW).day).toBe(start);
    expect(applyTaskCompletion(start, "missing", "complete", NOW).day).toBe(start);
  });

  it("completes a loose task without touching any goal", () => {
    const start = day();
    const result = applyTaskCompletion(start, "loose", "complete", NOW);
    expect(result.day.goalTree).toEqual(start.goalTree);
    expect(result).toMatchObject({ delta: 0, goalId: null, changed: true });
  });

  it("moves a skipped task's count when it's completed", () => {
    const start = day();
    start.tasks[0].status = "SKIPPED";
    start.goalTree[0].milestones[0].counts = { todo: 0, done: 1, skipped: 1 };
    start.goalTree[0].milestones[0].progress = 0.95;
    const result = applyTaskCompletion(start, "t1", "complete", NOW);
    expect(result.day.goalTree[0].milestones[0].counts).toEqual({ todo: 0, done: 2, skipped: 0 });
  });

  it("completes a backlog task and moves its goal", () => {
    const start = day();
    start.backlog = [task({ id: "someday", milestoneId: "m2", scheduledDate: null })];
    start.goalTree[0].milestones[1].counts = { todo: 2, done: 0, skipped: 0 };
    const result = applyTaskCompletion(start, "someday", "complete", NOW);
    expect(result.day.backlog[0].status).toBe("DONE");
    expect(result.day.goalTree[0].milestones[1].counts).toEqual({ todo: 1, done: 1, skipped: 0 });
    expect(result.delta).toBeGreaterThan(0);
  });

  it("doesn't mutate its input", () => {
    const start = day();
    const snapshot = structuredClone(start);
    applyTaskCompletion(start, "t1", "complete", NOW);
    expect(start).toEqual(snapshot);
  });
});

describe("applyServerCompletion", () => {
  it("overwrites the task, milestone and goal with the server's values", () => {
    const optimistic = applyTaskCompletion(day(), "t1", "complete", NOW).day;
    const serverTask = { ...optimistic.tasks[0], completedAt: new Date("2026-11-12T16:00:01Z") };
    const reconciled = applyServerCompletion(optimistic, {
      task: serverTask,
      milestone: { id: "m1", status: "OPEN", progress: 0.95 },
      goal: { id: "g1", progress: 0.31, metricCurrent: 0 },
    });
    expect(reconciled.tasks[0].completedAt).toEqual(serverTask.completedAt);
    expect(reconciled.goalTree[0].progress).toBe(0.31);
    expect(reconciled.goalTree[1]).toEqual(optimistic.goalTree[1]);
  });
});
