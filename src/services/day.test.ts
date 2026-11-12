import { describe, expect, it } from "vitest";
import { applyTaskCompletion } from "@/lib/domain/goal-tree";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { getDay, getGoalDetail, listGoals } from "./day";
import { NotFoundError } from "./errors";
import { completeTask, createTask, uncompleteTask } from "./tasks";

const NOW = new Date("2026-11-09T20:00:00Z");
const DATE = "2026-11-09";

async function setup() {
  const user = await seedUser();
  const goal = await seedGoal(user.id);
  const a = await seedMilestone(user.id, goal.id, 1);
  const b = await seedMilestone(user.id, goal.id, 3);
  const metric = await seedGoal(user.id, { progressMode: "METRIC", metricTarget: 500 });
  const t1 = await createTask(user.id, { title: "A today", link: { milestoneId: a.id }, scheduledDate: DATE });
  await createTask(user.id, { title: "A later", link: { milestoneId: a.id }, scheduledDate: "2026-11-12" });
  const t3 = await createTask(user.id, { title: "B today", link: { milestoneId: b.id }, scheduledDate: DATE });
  const run = await createTask(user.id, { title: "Run", link: { goalId: metric.id }, contribution: 16.5, scheduledDate: DATE });
  await createTask(user.id, { title: "Loose", scheduledDate: DATE });
  return { user, goal, a, b, metric, t1, t3, run };
}

describe("getDay", () => {
  it("returns the day's tasks and a goal tree with counts across all of each milestone's tasks", async () => {
    const s = await setup();
    const day = await getDay(s.user.id, DATE);
    expect(day.tasks.map((t) => t.title)).toEqual(["A today", "B today", "Run", "Loose"]);
    const tree = day.goalTree.find((g) => g.id === s.goal.id);
    expect(tree?.milestones.find((m) => m.id === s.a.id)?.counts).toEqual({ todo: 2, done: 0, skipped: 0 });
  });

  it("doesn't see another user's rows", async () => {
    await setup();
    const other = await seedUser();
    expect(await getDay(other.id, DATE)).toEqual({ date: DATE, tasks: [], backlog: [], goalTree: [] });
  });

  // The guarantee the optimistic update depends on: applying a completion to
  // the cached day lands on the same numbers the server stores.
  it.each([
    ["milestone task", "t1"],
    ["heavier milestone task", "t3"],
    ["metric task", "run"],
  ] as const)("optimistic completion of a %s matches the server", async (_label, key) => {
    const s = await setup();
    const taskId = s[key].id;
    const before = await getDay(s.user.id, DATE);

    const optimistic = applyTaskCompletion(before, taskId, "complete", NOW);
    const server = await completeTask(s.user.id, taskId, { now: NOW });
    const after = await getDay(s.user.id, DATE);

    expect(optimistic.day.goalTree).toEqual(after.goalTree);
    expect(optimistic.delta).toBeCloseTo(server.delta, 12);
    expect(optimistic.day.tasks.find((t) => t.id === taskId)?.status).toBe("DONE");

    const undo = applyTaskCompletion(after, taskId, "uncomplete", NOW);
    await uncompleteTask(s.user.id, taskId, { now: NOW });
    expect(undo.day.goalTree).toEqual((await getDay(s.user.id, DATE)).goalTree);
  });
});

describe("listGoals / getGoalDetail", () => {
  it("lists goals and loads one with milestone counts", async () => {
    const s = await setup();
    expect((await listGoals(s.user.id)).map((g) => g.id)).toEqual([s.goal.id, s.metric.id]);
    const detail = await getGoalDetail(s.user.id, s.goal.id);
    expect(detail.milestones.map((m) => m.counts.todo)).toEqual([2, 1]);
  });

  it("throws NotFound for another user's goal", async () => {
    const s = await setup();
    const other = await seedUser();
    await expect(getGoalDetail(other.id, s.goal.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
