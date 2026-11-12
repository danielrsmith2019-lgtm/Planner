import { describe, expect, it } from "vitest";
import type { GoalNode } from "@/lib/domain/goal-tree";
import { initialTaskForm, searchLinkOptions, validateTaskForm } from "./task-form";

const goal = (id: string, title: string, milestones: [string, string, "OPEN" | "DONE"][], status: GoalNode["status"] = "ACTIVE"): GoalNode => ({
  id,
  title,
  color: "#34C759",
  status,
  progressMode: "MILESTONES",
  metricUnit: null,
  metricTarget: null,
  metricCurrent: 0,
  progress: 0,
  pace: null,
  expectedProgress: null,
  isStalled: false,
  milestones: milestones.map(([mid, mtitle, mstatus]) => ({
    id: mid,
    title: mtitle,
    status: mstatus,
    weight: 1,
    progress: 0,
    counts: { todo: 0, done: 0, skipped: 0 },
  })),
});

const goals = [
  goal("g1", "Launch portfolio site", [["m1", "Write the about page", "OPEN"], ["m2", "Pick stack", "DONE"]]),
  goal("g2", "Run a marathon", [["m3", "Half marathon", "OPEN"]]),
  goal("g3", "Paused goal", [], "PAUSED"),
];

describe("searchLinkOptions", () => {
  it("lists active goals with their open milestones when the query is empty", () => {
    expect(searchLinkOptions(goals, "").map((o) => o.label)).toEqual([
      "Launch portfolio site",
      "Write the about page",
      "Run a marathon",
      "Half marathon",
    ]);
  });

  it("matches milestone titles and returns the milestone with its goal", () => {
    const [option] = searchLinkOptions(goals, "HALF");
    expect(option).toMatchObject({ kind: "milestone", milestoneId: "m3", goalId: "g2", goalTitle: "Run a marathon" });
  });

  it("a goal match brings its open milestones along", () => {
    expect(searchLinkOptions(goals, "portfolio").map((o) => o.label)).toEqual(["Launch portfolio site", "Write the about page"]);
  });
});

describe("validateTaskForm", () => {
  const today = "2026-11-12";

  it("starts on the viewed day", () => {
    expect(initialTaskForm(today, today).dateChoice).toBe("today");
    expect(initialTaskForm(today, "2026-11-13").dateChoice).toBe("tomorrow");
    expect(initialTaskForm(today, "2026-11-20")).toMatchObject({ dateChoice: "pick", pickedDate: "2026-11-20" });
  });

  it("builds the createTask input; choosing a milestone sends only the milestone", () => {
    const [milestone] = searchLinkOptions(goals, "about");
    const result = validateTaskForm(
      { ...initialTaskForm(today, today), title: " Draft bio ", link: milestone ?? null, dateChoice: "tomorrow", durationMin: 45, isTopThree: true },
      today,
    );
    expect(result).toEqual({
      ok: true,
      values: { title: "Draft bio", link: { milestoneId: "m1" }, scheduledDate: "2026-11-13", durationMin: 45, isTopThree: true },
    });
  });

  it("never sends Top 3 for a backlog task, and requires a title", () => {
    const backlog = validateTaskForm({ ...initialTaskForm(today, today), title: "x", dateChoice: "backlog", isTopThree: true }, today);
    expect(backlog).toMatchObject({ ok: true, values: { scheduledDate: null, isTopThree: false } });
    expect(validateTaskForm(initialTaskForm(today, today), today)).toMatchObject({ ok: false, errors: { title: "What's the task?" } });
  });
});

describe("taskFormFromTask", () => {
  it("fills the edit form from a task, finding its milestone link", async () => {
    const { taskFormFromTask } = await import("./task-form");
    const state = taskFormFromTask(
      {
        id: "t",
        goalId: "g1",
        milestoneId: "m1",
        title: "Draft bio",
        notes: null,
        status: "TODO",
        isTopThree: true,
        scheduledDate: "2026-11-13",
        startMin: 540,
        durationMin: 45,
        contribution: null,
        rank: "i0",
        carryCount: 0,
        completedAt: null,
      },
      "2026-11-12",
      goals,
    );
    expect(state).toMatchObject({ title: "Draft bio", dateChoice: "tomorrow", durationMin: 45, isTopThree: true, linkChanged: false });
    expect(state.link).toMatchObject({ kind: "milestone", milestoneId: "m1", goalTitle: "Launch portfolio site" });
  });
});
