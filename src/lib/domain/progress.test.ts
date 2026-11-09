import { describe, expect, it } from "vitest";
import {
  OPEN_MILESTONE_CAP,
  computeGoalProgress,
  computeMetricCurrent,
  computeMetricProgress,
  computeMilestoneProgress,
  computeMilestonesGoalProgress,
  type ContributingTask,
  type ProgressTask,
} from "./progress";

const todo: ProgressTask = { status: "TODO" };
const done: ProgressTask = { status: "DONE" };
const skipped: ProgressTask = { status: "SKIPPED" };

describe("computeMilestoneProgress", () => {
  it("is 0 for an open milestone with zero tasks", () => {
    expect(computeMilestoneProgress({ status: "OPEN", tasks: [] })).toBe(0);
  });

  it("is done / total for a partly finished milestone", () => {
    expect(computeMilestoneProgress({ status: "OPEN", tasks: [done, todo, todo, todo] })).toBe(0.25);
  });

  it("caps at 0.95 when every task is done but the milestone is still OPEN", () => {
    expect(computeMilestoneProgress({ status: "OPEN", tasks: [done, done, done] })).toBe(OPEN_MILESTONE_CAP);
    expect(OPEN_MILESTONE_CAP).toBe(0.95);
  });

  it("caps a single-task milestone too", () => {
    expect(computeMilestoneProgress({ status: "OPEN", tasks: [done] })).toBe(0.95);
  });

  it("excludes skipped tasks from the denominator", () => {
    // 1 done of (3 total - 1 skipped) = 0.5
    expect(computeMilestoneProgress({ status: "OPEN", tasks: [done, todo, skipped] })).toBe(0.5);
  });

  it("caps at 0.95 when the only remaining tasks are skipped", () => {
    expect(computeMilestoneProgress({ status: "OPEN", tasks: [done, done, skipped] })).toBe(0.95);
  });

  it("is 0 when every task is skipped (no divide by zero)", () => {
    expect(computeMilestoneProgress({ status: "OPEN", tasks: [skipped, skipped] })).toBe(0);
  });

  it("is 1 when the milestone is DONE, whatever its tasks say", () => {
    expect(computeMilestoneProgress({ status: "DONE", tasks: [done, done] })).toBe(1);
    expect(computeMilestoneProgress({ status: "DONE", tasks: [todo, todo] })).toBe(1);
    expect(computeMilestoneProgress({ status: "DONE", tasks: [] })).toBe(1);
  });
});

describe("computeMilestonesGoalProgress (Milestones mode)", () => {
  it("weights milestones 1 / 2 / 3", () => {
    // (1*1 + 2*0.5 + 3*0) / (1+2+3) = 2/6
    const progress = computeMilestonesGoalProgress([
      { weight: 1, progress: 1 },
      { weight: 2, progress: 0.5 },
      { weight: 3, progress: 0 },
    ]);
    expect(progress).toBeCloseTo(1 / 3, 10);
  });

  it("lets the heaviest milestone dominate", () => {
    // (1*0 + 2*0 + 3*1) / 6 = 0.5
    const progress = computeMilestonesGoalProgress([
      { weight: 1, progress: 0 },
      { weight: 2, progress: 0 },
      { weight: 3, progress: 1 },
    ]);
    expect(progress).toBe(0.5);
  });

  it("is 1 only when every milestone is DONE", () => {
    expect(
      computeMilestonesGoalProgress([
        { weight: 1, progress: 1 },
        { weight: 3, progress: 1 },
      ]),
    ).toBe(1);
    expect(
      computeMilestonesGoalProgress([
        { weight: 1, progress: 1 },
        { weight: 3, progress: 0.95 },
      ]),
    ).toBeLessThan(1);
  });

  it("is 0 for a goal with no milestones", () => {
    expect(computeMilestonesGoalProgress([])).toBe(0);
  });
});

describe("metric goals", () => {
  const run = (contribution: number | null, status: ContributingTask["status"] = "DONE"): ContributingTask => ({
    status,
    contribution,
  });

  it("counts only DONE contributions", () => {
    const tasks = [run(16), run(10, "TODO"), run(8, "SKIPPED"), run(5), run(null)];
    expect(computeMetricCurrent(tasks)).toBe(21);
  });

  it("avoids floating-point drift in the running total", () => {
    expect(computeMetricCurrent([run(0.1), run(0.2)])).toBe(0.3);
  });

  it("is 0 progress at 0", () => {
    expect(computeMetricProgress(0, 500)).toBe(0);
  });

  it("is 0.5 at 50%", () => {
    expect(computeMetricProgress(250, 500)).toBe(0.5);
  });

  it("is exactly 1 at 100%", () => {
    expect(computeMetricProgress(500, 500)).toBe(1);
  });

  it("caps overshoot at 1", () => {
    expect(computeMetricProgress(650, 500)).toBe(1);
  });

  it("is 0 when there is no usable target", () => {
    expect(computeMetricProgress(100, null)).toBe(0);
    expect(computeMetricProgress(100, 0)).toBe(0);
  });
});

describe("computeGoalProgress", () => {
  it("uses weighted milestones in MILESTONES mode", () => {
    const result = computeGoalProgress({
      progressMode: "MILESTONES",
      milestones: [
        { weight: 1, progress: 1 },
        { weight: 1, progress: 0 },
      ],
    });
    expect(result).toEqual({ progress: 0.5, metricCurrent: null });
  });

  it("recomputes metricCurrent from DONE tasks in METRIC mode", () => {
    const result = computeGoalProgress({
      progressMode: "METRIC",
      metricTarget: 500,
      tasks: [
        { status: "DONE", contribution: 200 },
        { status: "DONE", contribution: 50 },
        { status: "TODO", contribution: 16 },
      ],
    });
    expect(result).toEqual({ progress: 0.5, metricCurrent: 250 });
  });

  it("keeps the real total on overshoot but caps progress", () => {
    const result = computeGoalProgress({
      progressMode: "METRIC",
      metricTarget: 500,
      tasks: [{ status: "DONE", contribution: 612.5 }],
    });
    expect(result).toEqual({ progress: 1, metricCurrent: 612.5 });
  });
});
