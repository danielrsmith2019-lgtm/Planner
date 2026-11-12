import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { UserDTO } from "@/services/users";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";

// Server Actions run getCurrentUser() first; tests choose who is signed in.
const auth = vi.hoisted(() => ({ user: null as UserDTO | null }));
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => {
    if (auth.user === null) throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    return auth.user;
  },
}));

// Wrap getDay so one test can make it fail like a broken query would.
vi.mock("@/services/day", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/day")>();
  return { ...actual, getDay: vi.fn(actual.getDay) };
});

const services = await import("@/services/day");
const { completeTaskAction, createTaskAction } = await import("./tasks");
const { getDayAction } = await import("./day");
const { createGoalAction, getGoalAction } = await import("./goals");
const { saveJournalEntryAction } = await import("./journal");

async function signIn() {
  const row = await seedUser();
  auth.user = {
    id: row.id,
    authId: row.authId,
    email: row.email,
    name: null,
    timezone: row.timezone,
    dayStartsAt: row.dayStartsAt,
    morningRemindAt: null,
    eveningRemindAt: null,
  };
  return row;
}

describe("Server Actions", () => {
  beforeEach(() => {
    auth.user = null;
  });

  it("re-throws the login redirect when nobody is signed in", async () => {
    await expect(getDayAction({ date: "2026-11-12" })).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  it("rejects bad input with field errors before touching the database", async () => {
    await signIn();
    const result = await createTaskAction({ title: "", startMin: 2000 });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    if (result.ok) throw new Error("expected failure");
    expect(Object.keys(result.error.fieldErrors ?? {})).toEqual(expect.arrayContaining(["title", "startMin"]));
    expect(await getDayAction({ date: "11/12/2026" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it("completes a task and returns the goal and delta", async () => {
    const user = await signIn();
    const goal = await seedGoal(user.id);
    const milestone = await seedMilestone(user.id, goal.id);
    const created = await createTaskAction({ title: "Draft", link: { milestoneId: milestone.id }, scheduledDate: "2026-11-12" });
    if (!created.ok) throw new Error(created.error.message);

    const result = await completeTaskAction({ taskId: created.data.id });
    expect(result).toMatchObject({ ok: true, data: { changed: true, goal: { id: goal.id, progress: 0.95 } } });
    if (!result.ok) throw new Error("expected success");
    expect(result.data.delta).toBeCloseTo(0.95, 12);
  });

  it("maps service errors and hides another user's rows as NOT_FOUND", async () => {
    const owner = await seedUser();
    const goal = await seedGoal(owner.id);
    await signIn();
    expect(await getGoalAction({ goalId: goal.id })).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "That item no longer exists." },
    });
    expect(await createGoalAction({ title: "Run", progressMode: "METRIC", startDate: "2026-11-12" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
  });

  it("returns STALE with the current version for an outdated journal save", async () => {
    await signIn();
    const doc = { type: "doc", content: [] };
    const first = await saveJournalEntryAction({ date: "2026-11-12", content: doc, version: 0 });
    expect(first).toMatchObject({ ok: true, data: { version: 1 } });
    expect(await saveJournalEntryAction({ date: "2026-11-12", content: doc, version: 0 })).toMatchObject({
      ok: false,
      error: { code: "STALE", currentVersion: 1 },
    });
  });

  it("never sends a raw Prisma error to the client", async () => {
    await signIn();
    vi.mocked(services.getDay).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('relation "Task" does not exist', { code: "P2021", clientVersion: "7" }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getDayAction({ date: "2026-11-12" });
    expect(result).toEqual({ ok: false, error: { code: "INTERNAL", message: "Something went wrong. Try again." } });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
