import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { TOP_THREE_FULL_MESSAGE } from "@/lib/domain/day-lists";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { getDay } from "./day";
import { ValidationError } from "./errors";
import { completeTask, createTask, getUnfinishedTasks, resolveCarryOver } from "./tasks";

// 1:00pm New York on 2026-11-12
const NOW = new Date("2026-11-12T18:00:00Z");
const at = { now: NOW };

describe("Top 3 limit", () => {
  it("allows three Top 3 tasks per day and refuses a fourth with a friendly message", async () => {
    const user = await seedUser();
    for (const n of [1, 2, 3]) {
      await createTask(user.id, { title: `Top ${n}`, scheduledDate: "2026-11-12", isTopThree: true });
    }
    await expect(
      createTask(user.id, { title: "Top 4", scheduledDate: "2026-11-12", isTopThree: true }),
    ).rejects.toThrow(TOP_THREE_FULL_MESSAGE);
    // Another day has its own three; backlog tasks can't be Top 3.
    await createTask(user.id, { title: "Tomorrow", scheduledDate: "2026-11-13", isTopThree: true });
    await expect(createTask(user.id, { title: "Someday", isTopThree: true })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("getDay backlog", () => {
  it("lists unscheduled TODO tasks", async () => {
    const user = await seedUser();
    const someday = await createTask(user.id, { title: "Someday" });
    const done = await createTask(user.id, { title: "Done someday" });
    await completeTask(user.id, done.id, at);
    const day = await getDay(user.id, "2026-11-12");
    expect(day.backlog.map((t) => t.id)).toEqual([someday.id]);
  });
});

async function unfinishedSetup() {
  const user = await seedUser();
  const goal = await seedGoal(user.id);
  const m = await seedMilestone(user.id, goal.id);
  const old1 = await createTask(user.id, { title: "Old 1", scheduledDate: "2026-11-10", link: { milestoneId: m.id } });
  const old2 = await createTask(user.id, { title: "Old 2", scheduledDate: "2026-11-11", isTopThree: true });
  const old3 = await createTask(user.id, { title: "Old 3", scheduledDate: "2026-11-11" });
  const doneOld = await createTask(user.id, { title: "Done old", scheduledDate: "2026-11-11" });
  await completeTask(user.id, doneOld.id, at);
  await createTask(user.id, { title: "Today", scheduledDate: "2026-11-12" });
  return { user, goal, m, old1, old2, old3 };
}

describe("getUnfinishedTasks", () => {
  it("returns TODO tasks from before the user's today, oldest first", async () => {
    const s = await unfinishedSetup();
    const result = await getUnfinishedTasks(s.user.id, at);
    expect(result.today).toBe("2026-11-12");
    expect(result.tasks.map((t) => t.title)).toEqual(["Old 1", "Old 2", "Old 3"]);
  });
});

describe("resolveCarryOver", () => {
  it("keeps, reschedules and drops in one go", async () => {
    const s = await unfinishedSetup();
    const result = await resolveCarryOver(
      s.user.id,
      { keep: [s.old2.id], reschedule: [{ taskId: s.old3.id, date: "2026-11-15" }], drop: [s.old1.id] },
      at,
    );
    expect(result.ignoredIds).toEqual([]);
    expect(result.droppedIds).toEqual([s.old1.id]);
    const byId = new Map(result.carried.map((t) => [t.id, t]));
    expect(byId.get(s.old2.id)).toMatchObject({ scheduledDate: "2026-11-12", carryCount: 1, isTopThree: true });
    expect(byId.get(s.old3.id)).toMatchObject({ scheduledDate: "2026-11-15", carryCount: 1 });

    const dropped = await prisma.task.findUniqueOrThrow({ where: { id: s.old1.id } });
    expect(dropped.status).toBe("SKIPPED");
    // A skipped task leaves its milestone's denominator: 0 countable tasks -> 0.
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: s.m.id } })).progress).toBe(0);
    expect(await prisma.activityEvent.count({ where: { type: "TASK_SKIPPED" } })).toBe(1);
    expect(await prisma.activityEvent.count({ where: { type: "TASK_CARRIED" } })).toBe(2);
    expect((await getUnfinishedTasks(s.user.id, at)).tasks).toEqual([]);
  });

  it("drops the Top 3 flag when today is already full", async () => {
    const s = await unfinishedSetup();
    for (const n of [1, 2, 3]) await createTask(s.user.id, { title: `T${n}`, scheduledDate: "2026-11-12", isTopThree: true });
    const result = await resolveCarryOver(s.user.id, { keep: [s.old2.id], reschedule: [], drop: [] }, at);
    expect(result.carried[0]).toMatchObject({ scheduledDate: "2026-11-12", isTopThree: false });
  });

  it("ignores tasks that aren't unfinished from earlier, and rejects past reschedule dates", async () => {
    const s = await unfinishedSetup();
    const today = await createTask(s.user.id, { title: "Already today", scheduledDate: "2026-11-12" });
    const result = await resolveCarryOver(s.user.id, { keep: [today.id], reschedule: [], drop: [] }, at);
    expect(result.ignoredIds).toEqual([today.id]);
    await expect(
      resolveCarryOver(s.user.id, { keep: [], reschedule: [{ taskId: s.old1.id, date: "2026-11-11" }], drop: [] }, at),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      resolveCarryOver(s.user.id, { keep: [s.old1.id], reschedule: [], drop: [s.old1.id] }, at),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
