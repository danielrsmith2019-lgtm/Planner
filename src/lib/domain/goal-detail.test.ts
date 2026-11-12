import { describe, expect, it } from "vitest";
import {
  addTaskToGoalDetail,
  applyCompletionToGoalDetail,
  applyMilestoneChange,
  applyServerCompletionToGoalDetail,
  isLastOpenTask,
  isReadyToClose,
  type GoalDetailData,
  type MilestoneDetail,
} from "./goal-detail";
import type { DayTask } from "./goal-tree";

const NOW = new Date("2026-11-12T18:00:00Z");

const task = (id: string, milestoneId: string | null, status: DayTask["status"] = "TODO", contribution: number | null = null): DayTask => ({
  id,
  goalId: "g1",
  milestoneId,
  title: id,
  notes: null,
  status,
  isTopThree: false,
  scheduledDate: null,
  startMin: null,
  durationMin: 30,
  contribution,
  rank: id,
  carryCount: 0,
  completedAt: status === "DONE" ? NOW : null,
});

const milestone = (id: string, rank: string, weight: number, tasks: DayTask[]): MilestoneDetail => {
  const counts = {
    todo: tasks.filter((t) => t.status === "TODO").length,
    done: tasks.filter((t) => t.status === "DONE").length,
    skipped: tasks.filter((t) => t.status === "SKIPPED").length,
  };
  const countable = counts.todo + counts.done;
  return {
    id,
    goalId: "g1",
    title: id,
    status: "OPEN",
    weight,
    progress: countable === 0 ? 0 : Math.min(counts.done / countable, 0.95),
    counts,
    targetDate: null,
    rank,
    completedAt: null,
    tasks,
  };
};

// m1 (weight 1): 1 of 2 done. m2 (weight 3): 0 of 1.
const detail = (): GoalDetailData => ({
  id: "g1",
  title: "Portfolio",
  color: "#5856D6",
  status: "ACTIVE",
  progressMode: "MILESTONES",
  metricUnit: null,
  metricTarget: null,
  metricCurrent: 0,
  progress: 0.5 / 4,
  pace: null,
  expectedProgress: null,
  isStalled: false,
  why: null,
  startDate: "2026-11-01",
  targetDate: null,
  rank: "a0",
  completedAt: null,
  milestones: [milestone("m1", "a0", 1, [task("t1", "m1", "DONE"), task("t2", "m1")]), milestone("m2", "a1", 3, [task("t3", "m2")])],
  looseTasks: [],
});

describe("applyCompletionToGoalDetail", () => {
  it("checks the task off and recomputes milestone and goal", () => {
    const result = applyCompletionToGoalDetail(detail(), "t2", "complete", NOW);
    const m1 = result.detail.milestones[0];
    expect(m1.tasks[1]).toMatchObject({ status: "DONE", completedAt: NOW });
    expect(m1).toMatchObject({ counts: { todo: 0, done: 2, skipped: 0 }, progress: 0.95 });
    expect(result.detail.progress).toBeCloseTo(0.95 / 4, 12);
    expect(result.delta).toBeCloseTo(0.45 / 4, 12);
  });

  it("round-trips with uncomplete and ignores no-ops", () => {
    const start = detail();
    const done = applyCompletionToGoalDetail(start, "t3", "complete", NOW).detail;
    expect(applyCompletionToGoalDetail(done, "t3", "uncomplete", NOW).detail).toEqual(start);
    expect(applyCompletionToGoalDetail(start, "t1", "complete", NOW)).toMatchObject({ changed: false, detail: start });
    expect(applyCompletionToGoalDetail(start, "nope", "complete", NOW).changed).toBe(false);
  });

  it("moves metricCurrent for a loose metric task", () => {
    const metric: GoalDetailData = {
      ...detail(),
      progressMode: "METRIC",
      metricTarget: 100,
      metricCurrent: 10,
      progress: 0.1,
      milestones: [],
      looseTasks: [task("log", null, "DONE", 10), task("run", null, "TODO", 5)],
    };
    const result = applyCompletionToGoalDetail(metric, "run", "complete", NOW);
    expect(result.detail).toMatchObject({ metricCurrent: 15, progress: 0.15 });
    expect(applyCompletionToGoalDetail(metric, "log", "uncomplete", NOW).detail).toMatchObject({ metricCurrent: 0, progress: 0 });
  });
});

describe("applyServerCompletionToGoalDetail", () => {
  it("writes the server's task, milestone and goal values", () => {
    const optimistic = applyCompletionToGoalDetail(detail(), "t2", "complete", NOW).detail;
    const serverTask = { ...task("t2", "m1", "DONE"), completedAt: new Date("2026-11-12T18:00:02Z") };
    const result = applyServerCompletionToGoalDetail(optimistic, {
      task: serverTask,
      milestone: { id: "m1", status: "OPEN", progress: 0.95 },
      goal: { id: "g1", progress: 0.2375, metricCurrent: 0 },
    });
    expect(result.milestones[0].tasks[1].completedAt).toEqual(serverTask.completedAt);
    expect(result.progress).toBe(0.2375);
  });
});

describe("applyMilestoneChange", () => {
  it("marking a milestone DONE makes it 1 and lifts the weighted goal", () => {
    const result = applyMilestoneChange(detail(), "m2", { status: "DONE" }, NOW);
    expect(result.milestones[1]).toMatchObject({ status: "DONE", progress: 1, completedAt: NOW });
    expect(result.progress).toBeCloseTo((0.5 * 1 + 1 * 3) / 4, 12);
    const reopened = applyMilestoneChange(result, "m2", { status: "OPEN" }, NOW);
    expect(reopened.milestones[1]).toMatchObject({ status: "OPEN", progress: 0, completedAt: null });
  });

  it("re-weights and re-sorts by rank", () => {
    const heavier = applyMilestoneChange(detail(), "m1", { weight: 3 }, NOW);
    expect(heavier.progress).toBeCloseTo((0.5 * 3) / 6, 12);
    const moved = applyMilestoneChange(detail(), "m2", { rank: "0z" }, NOW);
    expect(moved.milestones.map((m) => m.id)).toEqual(["m2", "m1"]);
  });
});

describe("milestone prompts", () => {
  it("isLastOpenTask is true only for the final TODO of an open milestone", () => {
    const d = detail();
    expect(isLastOpenTask(d.milestones[0], "t2")).toBe(true);
    expect(isLastOpenTask(d.milestones[0], "t1")).toBe(false);
    expect(isLastOpenTask({ ...d.milestones[0], status: "DONE" }, "t2")).toBe(false);
  });

  it("isReadyToClose after the last task is done", () => {
    const d = applyCompletionToGoalDetail(detail(), "t2", "complete", NOW).detail;
    expect(isReadyToClose(d.milestones[0])).toBe(true);
    expect(isReadyToClose(d.milestones[1])).toBe(false);
  });
});

describe("addTaskToGoalDetail", () => {
  it("adds a TODO to its milestone, lowering progress", () => {
    const result = addTaskToGoalDetail(detail(), task("new", "m1"));
    expect(result.milestones[0]).toMatchObject({ counts: { todo: 2, done: 1, skipped: 0 } });
    expect(result.milestones[0].progress).toBeCloseTo(1 / 3, 12);
    expect(result.progress).toBeCloseTo(1 / 3 / 4, 12);
  });
});
