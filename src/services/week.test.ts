import { describe, expect, it } from "vitest";
import { planMoveToEnd, planWeekMove, applyWeekMove } from "@/lib/domain/week-board";
import { seedGoal, seedUser } from "../../test/seed";
import { getWeek } from "./day";
import { createTask, scheduleTask } from "./tasks";

const MON = "2026-11-09";

async function setup() {
  const user = await seedUser();
  const goal = await seedGoal(user.id);
  const a = await createTask(user.id, { title: "a", scheduledDate: MON, link: { goalId: goal.id } });
  const b = await createTask(user.id, { title: "b", scheduledDate: MON });
  const c = await createTask(user.id, { title: "c", scheduledDate: "2026-11-11", startMin: 540 });
  await createTask(user.id, { title: "next week", scheduledDate: "2026-11-16" });
  await createTask(user.id, { title: "backlog" });
  return { user, goal, a, b, c };
}

describe("getWeek", () => {
  it("returns 7 days of tasks from Monday in rank order, plus the goal tree", async () => {
    const s = await setup();
    const week = await getWeek(s.user.id, MON);
    expect(week.days.map((d) => d.date)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(week.days[0].tasks.map((t) => t.title)).toEqual(["a", "b"]);
    expect(week.days[2].tasks.map((t) => t.title)).toEqual(["c"]);
    expect(week.days.flatMap((d) => d.tasks).length).toBe(3);
    expect(week.goalTree.map((g) => g.id)).toEqual([s.goal.id]);
  });

  it("an optimistic move matches the server after scheduleTask", async () => {
    const s = await setup();
    let cached = await getWeek(s.user.id, MON);

    const across = planWeekMove(cached, s.b.id, "2026-11-11", s.c.id);
    if (across === null) throw new Error("expected a move");
    cached = applyWeekMove(cached, across);
    await scheduleTask(s.user.id, s.b.id, { scheduledDate: across.toDate, startMin: null, durationMin: 30, rank: across.rank });
    expect(cached).toEqual(await getWeek(s.user.id, MON));
    expect(cached.days[2].tasks.map((t) => t.title)).toEqual(["b", "c"]);

    const within = planWeekMove(cached, s.b.id, "2026-11-11", s.c.id);
    if (within === null) throw new Error("expected a move");
    cached = applyWeekMove(cached, within);
    await scheduleTask(s.user.id, s.b.id, { scheduledDate: within.toDate, startMin: null, durationMin: 30, rank: within.rank });
    expect(cached).toEqual(await getWeek(s.user.id, MON));
    expect(cached.days[2].tasks.map((t) => t.title)).toEqual(["c", "b"]);

    const end = planMoveToEnd(cached, s.a.id, "2026-11-15");
    if (end === null) throw new Error("expected a move");
    cached = applyWeekMove(cached, end);
    await scheduleTask(s.user.id, s.a.id, { scheduledDate: end.toDate, startMin: null, durationMin: 30, rank: end.rank });
    expect(cached).toEqual(await getWeek(s.user.id, MON));
  });
});

describe("scheduleTask on the week", () => {
  it("appends when no rank is given, and keeps Top 3 at three per day", async () => {
    const user = await seedUser();
    const existing = await createTask(user.id, { title: "existing", scheduledDate: "2026-11-12" });
    const moving = await createTask(user.id, { title: "moving", scheduledDate: MON, isTopThree: true });
    const moved = await scheduleTask(user.id, moving.id, { scheduledDate: "2026-11-12", startMin: null, durationMin: 30 });
    expect(moved.rank > existing.rank).toBe(true);
    expect(moved.isTopThree).toBe(true);

    for (const n of [1, 2, 3]) await createTask(user.id, { title: `t${n}`, scheduledDate: "2026-11-13", isTopThree: true });
    const intoFull = await scheduleTask(user.id, moving.id, { scheduledDate: "2026-11-13", startMin: null, durationMin: 30 });
    expect(intoFull.isTopThree).toBe(false);
  });
});
