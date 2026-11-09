import { describe, expect, it } from "vitest";
import { buildRecap, type RecapEvent, type RecapGoal } from "./recap";

const goals: RecapGoal[] = [
  { id: "marathon", title: "Marathon", color: "#34C759" },
  { id: "portfolio", title: "Portfolio", color: "#5856D6" },
];

let clock = 0;
const event = (
  type: RecapEvent["type"],
  taskId: string | null,
  goalId: string | null,
  before?: number,
  after?: number,
): RecapEvent => ({
  type,
  taskId,
  goalId,
  occurredAt: new Date(Date.UTC(2026, 10, 9, 12, 0, clock++)),
  payload: before === undefined ? null : { before, after, delta: (after ?? 0) - before },
});

describe("buildRecap", () => {
  it("is empty with no events", () => {
    expect(buildRecap([], goals)).toEqual({ goals: [], looseTaskIds: [] });
  });

  it("groups completed tasks by goal, in the goals' order", () => {
    const events = [
      event("TASK_COMPLETED", "t-site", "portfolio", 0.2, 0.3),
      event("TASK_COMPLETED", "t-run", "marathon", 0.4, 0.42),
      event("TASK_COMPLETED", "t-gym", "marathon", 0.42, 0.44),
    ];
    expect(buildRecap(events, goals).goals).toEqual([
      {
        goalId: "marathon",
        title: "Marathon",
        color: "#34C759",
        tasksDone: 2,
        taskIds: ["t-run", "t-gym"],
        progressBefore: 0.4,
        progressAfter: 0.44,
      },
      {
        goalId: "portfolio",
        title: "Portfolio",
        color: "#5856D6",
        tasksDone: 1,
        taskIds: ["t-site"],
        progressBefore: 0.2,
        progressAfter: 0.3,
      },
    ]);
  });

  it("drops a task that was completed then uncompleted", () => {
    const events = [
      event("TASK_COMPLETED", "t-run", "marathon", 0.4, 0.42),
      event("TASK_UNCOMPLETED", "t-run", "marathon", 0.42, 0.4),
    ];
    expect(buildRecap(events, goals)).toEqual({ goals: [], looseTaskIds: [] });
  });

  it("keeps the other tasks of a goal when one is uncompleted, with net progress", () => {
    const events = [
      event("TASK_COMPLETED", "t-run", "marathon", 0.4, 0.42),
      event("TASK_COMPLETED", "t-gym", "marathon", 0.42, 0.44),
      event("TASK_UNCOMPLETED", "t-run", "marathon", 0.44, 0.42),
    ];
    const [marathon] = buildRecap(events, goals).goals;
    expect(marathon.tasksDone).toBe(1);
    expect(marathon.taskIds).toEqual(["t-gym"]);
    expect(marathon.progressBefore).toBe(0.4);
    expect(marathon.progressAfter).toBe(0.42);
  });

  it("counts a task once if it was completed, uncompleted and completed again", () => {
    const events = [
      event("TASK_COMPLETED", "t-run", "marathon", 0.4, 0.42),
      event("TASK_UNCOMPLETED", "t-run", "marathon", 0.42, 0.4),
      event("TASK_COMPLETED", "t-run", "marathon", 0.4, 0.42),
    ];
    const [marathon] = buildRecap(events, goals).goals;
    expect(marathon.tasksDone).toBe(1);
    expect(marathon.progressAfter).toBe(0.42);
  });

  it("orders events by occurredAt, not by array position", () => {
    const completed = event("TASK_COMPLETED", "t-run", "marathon", 0.4, 0.42);
    const uncompleted = event("TASK_UNCOMPLETED", "t-run", "marathon", 0.42, 0.4);
    expect(buildRecap([uncompleted, completed], goals).goals).toEqual([]);
  });

  it("lists tasks with no goal as loose tasks", () => {
    const events = [event("TASK_COMPLETED", "t-laundry", null), event("TASK_COMPLETED", "t-run", "marathon", 0.4, 0.42)];
    const recap = buildRecap(events, goals);
    expect(recap.looseTaskIds).toEqual(["t-laundry"]);
    expect(recap.goals).toHaveLength(1);
  });

  it("treats a task whose goal isn't in the list as loose", () => {
    const recap = buildRecap([event("TASK_COMPLETED", "t-old", "archived-goal", 0.1, 0.2)], goals);
    expect(recap).toEqual({ goals: [], looseTaskIds: ["t-old"] });
  });

  it("ignores other event types and events without a task", () => {
    const events = [
      event("DAY_PLANNED", null, null),
      event("TASK_CARRIED", "t-run", "marathon"),
      event("TASK_SKIPPED", "t-gym", "marathon"),
      event("MILESTONE_COMPLETED", null, "marathon", 0.4, 0.6),
    ];
    expect(buildRecap(events, goals)).toEqual({ goals: [], looseTaskIds: [] });
  });

  it("reports null progress when the payload is missing or malformed", () => {
    const missing = event("TASK_COMPLETED", "t-run", "marathon");
    const malformed: RecapEvent = { ...event("TASK_COMPLETED", "t-gym", "marathon"), payload: { before: "lots" } };
    const [marathon] = buildRecap([missing, malformed], goals).goals;
    expect(marathon.tasksDone).toBe(2);
    expect(marathon.progressBefore).toBeNull();
    expect(marathon.progressAfter).toBeNull();
  });
});
