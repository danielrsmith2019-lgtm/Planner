import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyCompletionToGoalDetail, applyMilestoneChange } from "@/lib/domain/goal-detail";
import { rankBetween } from "@/lib/domain/rank";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { getGoalDetail } from "./day";
import { NotFoundError, ValidationError } from "./errors";
import { setMilestoneStatus, updateMilestone } from "./milestones";
import { completeTask, createTask, logProgress, uncompleteTask } from "./tasks";

const NOW = new Date("2026-11-12T18:00:00Z");

async function setup() {
  const user = await seedUser();
  const goal = await seedGoal(user.id);
  const a = await seedMilestone(user.id, goal.id, 1);
  const b = await seedMilestone(user.id, goal.id, 2);
  // seedMilestone's ranks are test labels; give these real rankBetween keys.
  await prisma.milestone.update({ where: { id: a.id }, data: { rank: "i0" } });
  await prisma.milestone.update({ where: { id: b.id }, data: { rank: "i1" } });
  const a1 = await createTask(user.id, { title: "a1", link: { milestoneId: a.id } });
  const a2 = await createTask(user.id, { title: "a2", link: { milestoneId: a.id } });
  const b1 = await createTask(user.id, { title: "b1", link: { milestoneId: b.id } });
  await completeTask(user.id, a1.id, { now: NOW });
  return { user, goal, a, b, a1, a2, b1 };
}

describe("getGoalDetail", () => {
  it("returns milestones in rank order with their tasks and counts", async () => {
    const s = await setup();
    const detail = await getGoalDetail(s.user.id, s.goal.id);
    expect(detail.milestones.map((m) => m.id)).toEqual([s.a.id, s.b.id]);
    expect(detail.milestones[0].tasks.map((t) => t.title)).toEqual(["a1", "a2"]);
    expect(detail.milestones[0].counts).toEqual({ todo: 1, done: 1, skipped: 0 });
    expect(detail.looseTasks).toEqual([]);
  });

  // The optimistic update on the detail page must land where the server does.
  it("optimistic completion and milestone changes match the server", async () => {
    const s = await setup();
    let cached = await getGoalDetail(s.user.id, s.goal.id);

    cached = applyCompletionToGoalDetail(cached, s.a2.id, "complete", NOW).detail;
    await completeTask(s.user.id, s.a2.id, { now: NOW });
    expect(cached).toEqual(await getGoalDetail(s.user.id, s.goal.id));

    cached = applyMilestoneChange(cached, s.a.id, { status: "DONE" }, NOW);
    await setMilestoneStatus(s.user.id, s.a.id, "DONE", { now: NOW });
    expect(cached).toEqual(await getGoalDetail(s.user.id, s.goal.id));

    cached = applyMilestoneChange(cached, s.b.id, { weight: 3 }, NOW);
    await updateMilestone(s.user.id, s.b.id, { weight: 3 });
    expect(cached).toEqual(await getGoalDetail(s.user.id, s.goal.id));

    const first = rankBetween(null, cached.milestones[0].rank);
    cached = applyMilestoneChange(cached, s.b.id, { rank: first }, NOW);
    await updateMilestone(s.user.id, s.b.id, { rank: first });
    expect(cached).toEqual(await getGoalDetail(s.user.id, s.goal.id));
    expect(cached.milestones.map((m) => m.id)).toEqual([s.b.id, s.a.id]);
  });
});

describe("setMilestoneStatus", () => {
  it("closes a milestone at 100%, logs MILESTONE_COMPLETED, and reopens", async () => {
    const s = await setup();
    const closed = await setMilestoneStatus(s.user.id, s.a.id, "DONE", { now: NOW });
    expect(closed.milestone).toMatchObject({ status: "DONE", progress: 1, completedAt: NOW });
    expect(closed.delta).toBeCloseTo(0.5 / 3, 12);
    const events = await prisma.activityEvent.findMany({ where: { type: "MILESTONE_COMPLETED" } });
    expect(events).toHaveLength(1);
    const reopened = await setMilestoneStatus(s.user.id, s.a.id, "OPEN");
    expect(reopened.milestone).toMatchObject({ status: "OPEN", progress: 0.5, completedAt: null });
  });

  it("finishing the last task never closes the milestone by itself", async () => {
    const s = await setup();
    const result = await completeTask(s.user.id, s.a2.id, { now: NOW });
    expect(result.milestone).toMatchObject({ status: "OPEN", progress: 0.95 });
  });

  it("is scoped to the user", async () => {
    const s = await setup();
    const other = await seedUser();
    await expect(setMilestoneStatus(other.id, s.a.id, "DONE")).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateMilestone(other.id, s.a.id, { weight: 2 })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateMilestone", () => {
  it("rejects bad weights and ranks", async () => {
    const s = await setup();
    await expect(updateMilestone(s.user.id, s.a.id, { weight: 4 })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateMilestone(s.user.id, s.a.id, { rank: "A B" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("logProgress", () => {
  it("creates a DONE task with the contribution on today and moves the metric", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id, { progressMode: "METRIC", metricTarget: 500 });
    const result = await logProgress(user.id, goal.id, { amount: 8.25 }, { now: NOW });
    expect(result.task).toMatchObject({
      status: "DONE",
      contribution: 8.25,
      scheduledDate: "2026-11-12",
      title: "Logged 8.25 km",
      goalId: goal.id,
      milestoneId: null,
    });
    expect(result.goal).toMatchObject({ metricCurrent: 8.25, progress: 8.25 / 500 });
    expect(result.delta).toBeCloseTo(8.25 / 500, 12);
    expect(await prisma.activityEvent.count({ where: { taskId: result.task.id, type: "TASK_COMPLETED" } })).toBe(1);

    const detail = await getGoalDetail(user.id, goal.id);
    expect(detail.looseTasks.map((t) => t.id)).toEqual([result.task.id]);

    // Unchecking the log entry is a normal uncomplete and takes the amount back out.
    const undone = await uncompleteTask(user.id, result.task.id);
    expect(undone.goal).toMatchObject({ metricCurrent: 0, progress: 0 });
  });

  it("refuses milestone goals and non-positive amounts", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    await expect(logProgress(user.id, goal.id, { amount: 5 })).rejects.toBeInstanceOf(ValidationError);
    const metric = await seedGoal(user.id, { progressMode: "METRIC", metricTarget: 10 });
    await expect(logProgress(user.id, metric.id, { amount: 0 })).rejects.toBeInstanceOf(ValidationError);
  });
});
