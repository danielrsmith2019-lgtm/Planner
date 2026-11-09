import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { StaleEntryError, ValidationError } from "./errors";
import { getJournalEntry, saveJournalEntry } from "./journal";
import { createTask } from "./tasks";

const DATE = "2026-11-09";
const text = (value: string) => ({ type: "text", text: value });
const mention = (targetType: string, id: string, label: string) => ({ type: "mention", attrs: { id, label, targetType } });
const paragraph = (id: string, ...content: object[]) => ({ type: "paragraph", attrs: { id }, content });
const doc = (...content: object[]) => ({ type: "doc", content });

async function setup() {
  const user = await seedUser();
  const goal = await seedGoal(user.id, { title: "Marathon" });
  const milestone = await seedMilestone(user.id, goal.id);
  const task = await createTask(user.id, { title: "Long run", link: { milestoneId: milestone.id } });
  return { user, goal, milestone, task };
}

describe("saveJournalEntry", () => {
  it("creates the entry at version 1 with plain text and links", async () => {
    const { user, goal, task } = await setup();
    const saved = await saveJournalEntry(user.id, DATE, {
      version: 0,
      content: doc(
        paragraph("p1", text("Felt good on "), mention("TASK", task.id, "Long run")),
        paragraph("p2", text("Big week for "), mention("GOAL", goal.id, "Marathon")),
      ),
      intention: "Sleep by 10",
      mood: 4,
    });

    expect(saved).toMatchObject({
      date: DATE,
      version: 1,
      plainText: "Felt good on @Long run\nBig week for @Marathon",
      intention: "Sleep by 10",
      mood: 4,
      linkCount: 2,
    });
    const links = await prisma.journalLink.findMany({ orderBy: { blockId: "asc" } });
    expect(links).toMatchObject([
      { blockId: "p1", targetType: "TASK", taskId: task.id, goalId: null, milestoneId: null, snippet: "Felt good on @Long run" },
      { blockId: "p2", targetType: "GOAL", goalId: goal.id, taskId: null, milestoneId: null },
    ]);
  });

  it("increments the version and replaces every link on each save", async () => {
    const { user, goal, milestone } = await setup();
    await saveJournalEntry(user.id, DATE, { version: 0, content: doc(paragraph("p1", mention("GOAL", goal.id, "Marathon"))) });

    const second = await saveJournalEntry(user.id, DATE, {
      version: 1,
      content: doc(paragraph("p9", text("Now about "), mention("MILESTONE", milestone.id, "Base"))),
    });

    expect(second.version).toBe(2);
    const links = await prisma.journalLink.findMany();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ blockId: "p9", targetType: "MILESTONE", milestoneId: milestone.id });
  });

  it("throws StaleEntryError when the version doesn't match, and changes nothing", async () => {
    const { user, goal } = await setup();
    await saveJournalEntry(user.id, DATE, { version: 0, content: doc(paragraph("p1", text("v1"))) });
    await saveJournalEntry(user.id, DATE, { version: 1, content: doc(paragraph("p1", text("v2 "), mention("GOAL", goal.id, "M"))) });

    const stale = saveJournalEntry(user.id, DATE, { version: 1, content: doc(paragraph("p1", text("from an old tab"))) });
    await expect(stale).rejects.toBeInstanceOf(StaleEntryError);
    await expect(stale).rejects.toMatchObject({ currentVersion: 2 });

    const entry = await getJournalEntry(user.id, DATE);
    expect(entry).toMatchObject({ version: 2, plainText: "v2 @M", linkCount: 1 });
  });

  it("treats a second 'new entry' save for the same day as stale", async () => {
    const { user } = await setup();
    await saveJournalEntry(user.id, DATE, { version: 0, content: doc(paragraph("p1", text("first"))) });
    await expect(
      saveJournalEntry(user.id, DATE, { version: 0, content: doc(paragraph("p1", text("second tab"))) }),
    ).rejects.toMatchObject({ name: "StaleEntryError", currentVersion: 1 });
  });

  it("rejects a non-zero version when no entry exists yet", async () => {
    const { user } = await setup();
    await expect(saveJournalEntry(user.id, DATE, { version: 3, content: doc() })).rejects.toBeInstanceOf(StaleEntryError);
  });

  it("keeps intention and mood when they're omitted, and clears them with null", async () => {
    const { user } = await setup();
    await saveJournalEntry(user.id, DATE, { version: 0, content: doc(), intention: "Run early", mood: 3 });
    const kept = await saveJournalEntry(user.id, DATE, { version: 1, content: doc(paragraph("p1", text("more"))) });
    expect(kept).toMatchObject({ intention: "Run early", mood: 3 });
    const cleared = await saveJournalEntry(user.id, DATE, { version: 2, content: doc(), intention: null, mood: null });
    expect(cleared).toMatchObject({ intention: null, mood: null });
  });

  it("drops mentions of other users' goals and of deleted items", async () => {
    const { user, goal } = await setup();
    const stranger = await seedUser();
    const theirGoal = await seedGoal(stranger.id);
    const saved = await saveJournalEntry(user.id, DATE, {
      version: 0,
      content: doc(
        paragraph("p1", mention("GOAL", theirGoal.id, "Not yours")),
        paragraph("p2", mention("TASK", "deleted-task-id", "Gone")),
        paragraph("p3", mention("GOAL", goal.id, "Mine")),
      ),
    });
    expect(saved.linkCount).toBe(1);
    expect((await prisma.journalLink.findFirstOrThrow()).goalId).toBe(goal.id);
  });

  it("stores one link when the same target appears twice in one block", async () => {
    const { user, goal } = await setup();
    const saved = await saveJournalEntry(user.id, DATE, {
      version: 0,
      content: doc(paragraph("p1", mention("GOAL", goal.id, "M"), text(" and again "), mention("GOAL", goal.id, "M"))),
    });
    expect(saved.linkCount).toBe(1);
    expect(await prisma.journalLink.count()).toBe(1);
  });

  it("keeps each user's entries separate", async () => {
    const { user } = await setup();
    const other = await seedUser();
    await saveJournalEntry(user.id, DATE, { version: 0, content: doc(paragraph("p1", text("mine"))) });
    const theirs = await saveJournalEntry(other.id, DATE, { version: 0, content: doc(paragraph("p1", text("theirs"))) });
    expect(theirs.version).toBe(1);
    expect((await getJournalEntry(user.id, DATE))?.plainText).toBe("mine");
  });

  it("rejects invalid input", async () => {
    const { user } = await setup();
    const base = { version: 0, content: doc() };
    await expect(saveJournalEntry(user.id, "2026-02-30", base)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveJournalEntry(user.id, DATE, { ...base, content: { type: "paragraph" } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(saveJournalEntry(user.id, DATE, { ...base, mood: 6 })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveJournalEntry(user.id, DATE, { ...base, version: -1 })).rejects.toBeInstanceOf(ValidationError);
  });
});
