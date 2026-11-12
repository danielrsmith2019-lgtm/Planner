import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ValidationError } from "./errors";
import { DEFAULT_TIMEZONE, ensureUser, getUserByAuthId } from "./users";

const authUser = (overrides: Partial<{ id: string; email: string; user_metadata: Record<string, unknown> }> = {}) => ({
  id: randomUUID(),
  email: "dan@example.com",
  user_metadata: { display_name: "Dan" },
  ...overrides,
});

describe("ensureUser", () => {
  it("creates the User with the browser's timezone on first sign-in", async () => {
    const auth = authUser();
    const user = await ensureUser(auth, "Europe/Lisbon");
    expect(user).toMatchObject({ authId: auth.id, email: "dan@example.com", name: "Dan", timezone: "Europe/Lisbon", dayStartsAt: 240 });
    expect(await prisma.user.count()).toBe(1);
  });

  it("returns the same row on later sign-ins without changing the timezone", async () => {
    const auth = authUser();
    const first = await ensureUser(auth, "America/New_York");
    const again = await ensureUser(auth, "Asia/Tokyo");
    expect(again.id).toBe(first.id);
    expect(again.timezone).toBe("America/New_York");
    expect(await prisma.user.count()).toBe(1);
  });

  it("falls back to the default timezone when the browser's is missing or unknown", async () => {
    expect((await ensureUser(authUser({ email: "a@example.com" }), null)).timezone).toBe(DEFAULT_TIMEZONE);
    expect((await ensureUser(authUser({ email: "b@example.com" }), "Mars/Olympus")).timezone).toBe(DEFAULT_TIMEZONE);
  });

  it("reads Google's full_name and keeps email in sync", async () => {
    const auth = authUser({ email: "Dan@Example.com", user_metadata: { full_name: "Dan Smith" } });
    expect(await ensureUser(auth, null)).toMatchObject({ email: "dan@example.com", name: "Dan Smith" });
    const moved = await ensureUser({ ...auth, email: "dan.new@example.com" }, null);
    expect(moved.email).toBe("dan.new@example.com");
  });

  it("relinks an existing row when the same email signs in under a new auth id", async () => {
    const original = await ensureUser(authUser(), "America/New_York");
    const recreated = authUser();
    const user = await ensureUser(recreated, "Asia/Tokyo");
    expect(user.id).toBe(original.id);
    expect(user.authId).toBe(recreated.id);
    expect(user.timezone).toBe("America/New_York");
    expect(await getUserByAuthId(original.authId)).toBeNull();
  });

  it("requires an id and an email", async () => {
    await expect(ensureUser({ id: "", email: "x@example.com" }, null)).rejects.toBeInstanceOf(ValidationError);
    await expect(ensureUser({ id: randomUUID(), email: null }, null)).rejects.toBeInstanceOf(ValidationError);
  });
});
