import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dbSnapshot, seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { NotFoundError, ValidationError } from "./errors";
import { recomputeGoal } from "./goals";
import {
  carryOverTasks,
  completeTask,
  createTask,
  scheduleTask,
  setTaskLink,
  uncompleteTask,
} from "./tasks";

// 2026-11-09 at 3:00pm New York time
const NOW = new Date("2026-11-09T20:00:00Z");
const at = { now: NOW };

type Setup = Awaited<ReturnType<typeof milestoneGoal>>;

/**
 * Goal (MILESTONES) with milestone A (weight 1: one task done, one to do)
 * and milestone B (weight 2: one task to do).
 */
async function milestoneGoal() {
  const user = await seedUser();
  const goal = await seedGoal(user.id);
  const a = await seedMilestone(user.id, goal.id, 1);
  const b = await seedMilestone(user.id, goal.id, 2);
  const aDone = await createTask(user.id, { title: "A done", link: { milestoneId: a.id }, scheduledDate: "2026-11-09" });
  const aTodo = await createTask(user.id, { title: "A todo", link: { milestoneId: a.id }, scheduledDate: "2026-11-09" });
  const bTodo = await createTask(user.id, { title: "B todo", link: { milestoneId: b.id }, scheduledDate: "2026-11-09" });
  await completeTask(user.id, aDone.id, at);
  await prisma.activityEvent.deleteMany({});
  return { user, goal, a, b, aDone, aTodo, bTodo };
}

describe("completeTask / uncompleteTask", () => {
  let s: Setup;
  beforeEach(async () => {
    s = await milestoneGoal();
  });

  it("starts from the expected cached progress", async () => {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: s.goal.id } });
    const a = await prisma.milestone.findUniqueOrThrow({ where: { id: s.a.id } });
    expect(a.progress).toBe(0.5);
    expect(goal.progress).toBeCloseTo((1 * 0.5 + 2 * 0) / 3, 12);
  });

  it("completes a task, recomputes milestone and goal, and logs the event", async () => {
    const result = await completeTask(s.user.id, s.aTodo.id, at);

    expect(result.changed).toBe(true);
    expect(result.task.status).toBe("DONE");
    expect(result.task.completedAt).toEqual(NOW);
    expect(result.milestone?.progress).toBe(0.95); // all done but still OPEN
    expect(result.goal?.progress).toBeCloseTo((1 * 0.95) / 3, 12);
    expect(result.delta).toBeCloseTo((0.95 - 0.5) / 3, 12);

    const events = await prisma.activityEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "TASK_COMPLETED",
      taskId: s.aTodo.id,
      goalId: s.goal.id,
      milestoneId: s.a.id,
      localDate: new Date("2026-11-09T00:00:00Z"),
    });
    expect(events[0].payload).toEqual({ before: 0.5 / 3, after: 0.95 / 3, delta: result.delta });
  });

  it("complete -> uncomplete returns every row to the identical state", async () => {
    const before = await dbSnapshot();

    await completeTask(s.user.id, s.aTodo.id, at);
    expect(await dbSnapshot()).not.toEqual(before);

    const undo = await uncompleteTask(s.user.id, s.aTodo.id, at);
    expect(undo.changed).toBe(true);
    expect(undo.task.completedAt).toBeNull();
    expect(await dbSnapshot()).toEqual(before);
  });

  it("logs an uncomplete event that exactly mirrors the complete event", async () => {
    const done = await completeTask(s.user.id, s.aTodo.id, at);
    const undone = await uncompleteTask(s.user.id, s.aTodo.id, at);
    expect(undone.delta).toBe(-done.delta);

    const events = await prisma.activityEvent.findMany({ orderBy: { occurredAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["TASK_COMPLETED", "TASK_UNCOMPLETED"]);
    const [c, u] = events.map((e) => e.payload as { before: number; after: number; delta: number });
    expect(u.before).toBe(c.after);
    expect(u.after).toBe(c.before);
    expect(u.delta).toBe(-c.delta);
  });

  it("treats a second completeTask as a no-op", async () => {
    await completeTask(s.user.id, s.aTodo.id, at);
    const afterFirst = await dbSnapshot();
    const eventsAfterFirst = await prisma.activityEvent.count();

    const later = new Date(NOW.getTime() + 60_000);
    const second = await completeTask(s.user.id, s.aTodo.id, { now: later });

    expect(second.changed).toBe(false);
    expect(second.delta).toBe(0);
    expect(second.task.completedAt).toEqual(NOW); // not bumped to `later`
    expect(second.goal?.progress).toBeCloseTo(0.95 / 3, 12);
    expect(await dbSnapshot()).toEqual(afterFirst);
    expect(await prisma.activityEvent.count()).toBe(eventsAfterFirst);
  });

  it("treats uncompleteTask on a TODO task as a no-op", async () => {
    const before = await dbSnapshot();
    const result = await uncompleteTask(s.user.id, s.bTodo.id, at);
    expect(result.changed).toBe(false);
    expect(await dbSnapshot()).toEqual(before);
    expect(await prisma.activityEvent.count()).toBe(0);
  });

  it("stamps localDate with the user's day, not the UTC date", async () => {
    // 2:30am EST on Nov 10 is still Nov 9 for a user whose day starts at 4:00am.
    await completeTask(s.user.id, s.aTodo.id, { now: new Date("2026-11-10T07:30:00Z") });
    const event = await prisma.activityEvent.findFirstOrThrow();
    expect(event.localDate).toEqual(new Date("2026-11-09T00:00:00Z"));
  });

  it("can't touch another user's task", async () => {
    const intruder = await seedUser();
    const before = await dbSnapshot();
    await expect(completeTask(intruder.id, s.aTodo.id, at)).rejects.toBeInstanceOf(NotFoundError);
    await expect(uncompleteTask(intruder.id, s.aDone.id, at)).rejects.toBeInstanceOf(NotFoundError);
    expect(await dbSnapshot()).toEqual(before);
  });

  it("completes a loose task without touching any goal", async () => {
    const loose = await createTask(s.user.id, { title: "Laundry", scheduledDate: "2026-11-09" });
    const before = await prisma.goal.findUniqueOrThrow({ where: { id: s.goal.id } });
    const result = await completeTask(s.user.id, loose.id, at);
    expect(result).toMatchObject({ milestone: null, goal: null, delta: 0, changed: true });
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: s.goal.id } })).progress).toBe(before.progress);
    expect((await prisma.activityEvent.findFirstOrThrow()).payload).toBeNull();
  });
});

describe("metric goals", () => {
  it("adds the contribution to metricCurrent, and uncomplete restores the exact value", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id, { progressMode: "METRIC", metricTarget: 500 });
    const run1 = await createTask(user.id, { title: "Run", link: { goalId: goal.id }, contribution: 16.25 });
    const run2 = await createTask(user.id, { title: "Run", link: { goalId: goal.id }, contribution: 0.1 });
    await completeTask(user.id, run1.id, at);
    const before = await dbSnapshot();

    const result = await completeTask(user.id, run2.id, at);
    expect(result.goal?.metricCurrent).toBe(16.35);
    expect(result.goal?.progress).toBeCloseTo(16.35 / 500, 12);

    await uncompleteTask(user.id, run2.id, at);
    expect(await dbSnapshot()).toEqual(before);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).metricCurrent.toString()).toBe("16.25");
  });
});

describe("goalId always comes from the milestone", () => {
  it("copies goalId from the milestone on create", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    const milestone = await seedMilestone(user.id, goal.id);
    const task = await createTask(user.id, { title: "Draft", link: { milestoneId: milestone.id } });
    expect(task.goalId).toBe(goal.id);
    expect(task.milestoneId).toBe(milestone.id);
  });

  it("rejects a goalId passed alongside a milestoneId", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id);
    const other = await seedGoal(user.id);
    const milestone = await seedMilestone(user.id, goal.id);
    const sneaky = { milestoneId: milestone.id, goalId: other.id } as unknown as { milestoneId: string };
    await expect(createTask(user.id, { title: "Draft", link: sneaky })).rejects.toBeInstanceOf(ValidationError);
  });

  it("re-derives goalId when a task moves to a milestone of another goal, and recomputes both sides", async () => {
    const user = await seedUser();
    const g1 = await seedGoal(user.id);
    const g2 = await seedGoal(user.id);
    const m1 = await seedMilestone(user.id, g1.id);
    const m2 = await seedMilestone(user.id, g2.id);
    const task = await createTask(user.id, { title: "Draft", link: { milestoneId: m1.id } });
    await completeTask(user.id, task.id, at);

    const moved = await setTaskLink(user.id, task.id, { milestoneId: m2.id });
    expect(moved.task.goalId).toBe(g2.id);
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: m1.id } })).progress).toBe(0);
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: m2.id } })).progress).toBe(0.95);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: g1.id } })).progress).toBe(0);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: g2.id } })).progress).toBe(0.95);
  });

  it("won't link to another user's milestone", async () => {
    const owner = await seedUser();
    const goal = await seedGoal(owner.id);
    const milestone = await seedMilestone(owner.id, goal.id);
    const intruder = await seedUser();
    await expect(createTask(intruder.id, { title: "x", link: { milestoneId: milestone.id } })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("recomputeGoal", () => {
  it("repairs corrupted cached fields from raw rows", async () => {
    const s = await milestoneGoal();
    const correct = await dbSnapshot();
    await prisma.milestone.update({ where: { id: s.a.id }, data: { progress: 0.9 } });
    await prisma.goal.update({ where: { id: s.goal.id }, data: { progress: 0.77, metricCurrent: 999 } });

    const repaired = await recomputeGoal(s.goal.id);
    expect(repaired.progress).toBeCloseTo(0.5 / 3, 12);
    const after = await dbSnapshot();
    expect(after.milestones).toEqual(correct.milestones);
    expect(after.goals[0].progress).toBe(correct.goals[0].progress);
  });

  it("rebuilds metricCurrent for METRIC goals", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id, { progressMode: "METRIC", metricTarget: 100 });
    const run = await createTask(user.id, { title: "Run", link: { goalId: goal.id }, contribution: 25 });
    await completeTask(user.id, run.id, at);
    await prisma.goal.update({ where: { id: goal.id }, data: { metricCurrent: 0, progress: 0 } });

    const repaired = await recomputeGoal(goal.id);
    expect(repaired).toMatchObject({ metricCurrent: 25, progress: 0.25 });
  });
});

describe("scheduleTask", () => {
  it("sets day, time, duration and rank", async () => {
    const user = await seedUser();
    const task = await createTask(user.id, { title: "Long run" });
    const scheduled = await scheduleTask(user.id, task.id, {
      scheduledDate: "2026-11-14",
      startMin: 420,
      durationMin: 90,
      rank: "i0",
    });
    expect(scheduled).toMatchObject({ scheduledDate: "2026-11-14", startMin: 420, durationMin: 90, rank: "i0" });
  });

  it("moves a task back to the backlog", async () => {
    const user = await seedUser();
    const task = await createTask(user.id, { title: "Read", scheduledDate: "2026-11-09", startMin: 600 });
    const backlog = await scheduleTask(user.id, task.id, { scheduledDate: null, startMin: null, durationMin: 30, rank: "i0" });
    expect(backlog).toMatchObject({ scheduledDate: null, startMin: null });
  });

  it("rejects invalid input", async () => {
    const user = await seedUser();
    const task = await createTask(user.id, { title: "Read" });
    const base = { scheduledDate: "2026-11-09", startMin: 600, durationMin: 30, rank: "i0" };
    await expect(scheduleTask(user.id, task.id, { ...base, scheduledDate: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(scheduleTask(user.id, task.id, { ...base, startMin: 1440 })).rejects.toBeInstanceOf(ValidationError);
    await expect(scheduleTask(user.id, task.id, { ...base, durationMin: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(scheduleTask(user.id, task.id, { ...base, scheduledDate: "2026-02-30" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("carryOverTasks", () => {
  it("moves TODO tasks to the end of the new day, bumps carryCount and logs TASK_CARRIED", async () => {
    const user = await seedUser();
    const existing = await createTask(user.id, { title: "Already today", scheduledDate: "2026-11-10" });
    const t1 = await createTask(user.id, { title: "Leftover 1", scheduledDate: "2026-11-09", startMin: 450 });
    const t2 = await createTask(user.id, { title: "Leftover 2", scheduledDate: "2026-11-09" });
    const done = await createTask(user.id, { title: "Finished", scheduledDate: "2026-11-09" });
    await completeTask(user.id, done.id, at);
    const otherDay = await createTask(user.id, { title: "Other day", scheduledDate: "2026-11-08" });

    const result = await carryOverTasks(user.id, "2026-11-09", "2026-11-10", [t1.id, t2.id, done.id, otherDay.id], {
      now: new Date("2026-11-10T13:00:00Z"),
    });

    expect(result.carried.map((t) => t.id)).toEqual([t1.id, t2.id]);
    expect(result.skippedIds.sort()).toEqual([done.id, otherDay.id].sort());
    for (const task of result.carried) {
      expect(task).toMatchObject({ scheduledDate: "2026-11-10", startMin: null, carryCount: 1 });
      expect(task.rank > existing.rank).toBe(true);
    }
    expect(result.carried[0].rank < result.carried[1].rank).toBe(true);

    const events = await prisma.activityEvent.findMany({ where: { type: "TASK_CARRIED" } });
    expect(events).toHaveLength(2);
    expect(events[0].localDate).toEqual(new Date("2026-11-10T00:00:00Z"));
    expect(events[0].payload).toMatchObject({ from: "2026-11-09", to: "2026-11-10", carryCount: 1 });
  });

  it("only carries forward", async () => {
    const user = await seedUser();
    await expect(carryOverTasks(user.id, "2026-11-10", "2026-11-09", ["x"])).rejects.toBeInstanceOf(ValidationError);
    await expect(carryOverTasks(user.id, "2026-11-10", "2026-11-10", ["x"])).rejects.toBeInstanceOf(ValidationError);
  });

  it("ignores another user's tasks", async () => {
    const owner = await seedUser();
    const task = await createTask(owner.id, { title: "Mine", scheduledDate: "2026-11-09" });
    const intruder = await seedUser();
    const result = await carryOverTasks(intruder.id, "2026-11-09", "2026-11-10", [task.id], at);
    expect(result).toEqual({ carried: [], skippedIds: [task.id] });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).carryCount).toBe(0);
  });
});
