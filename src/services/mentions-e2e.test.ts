import { generateUniqueIds } from "@tiptap/extension-unique-id";
import { describe, expect, it } from "vitest";
import { journalExtensions } from "@/components/journal/extensions";
import { prisma } from "@/lib/db";
import { seedGoal, seedMilestone, seedUser } from "../../test/seed";
import { getGoalReflections, getJournalEntry, saveJournalEntry } from "./journal";
import { pickGrouped, searchMentionables, type Mentionable } from "./mentionables";
import { createTask } from "./tasks";

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string };
const text = (value: string): Node => ({ type: "text", text: value });
const mention = (targetType: string, id: string, label: string): Node => ({ type: "mention", attrs: { id, label, targetType } });

describe("searchMentionables", () => {
  it("matches goals, open milestones and open tasks case-insensitively, grouped, max 8", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id, { title: "Run a marathon" });
    const m = await seedMilestone(user.id, goal.id);
    await prisma.milestone.update({ where: { id: m.id }, data: { title: "Half marathon in spring" } });
    const done = await seedMilestone(user.id, goal.id);
    await prisma.milestone.update({ where: { id: done.id }, data: { title: "Marathon done one", status: "DONE" } });
    await createTask(user.id, { title: "Buy marathon shoes", link: { goalId: goal.id } });
    await createTask(user.id, { title: "Laundry" });
    const other = await seedUser();
    await seedGoal(other.id, { title: "Marathon (not mine)" });

    const results = await searchMentionables(user.id, "MARATHON");
    expect(results.map((r) => [r.type, r.label])).toEqual([
      ["GOAL", "Run a marathon"],
      ["MILESTONE", "Half marathon in spring"],
      ["TASK", "Buy marathon shoes"],
    ]);
    expect(results[1]).toMatchObject({ color: goal.color, context: "Run a marathon" });
    expect((await searchMentionables(user.id, "")).length).toBeLessThanOrEqual(8);
  });

  it("shares the 8 slots 3 / 3 / 4, giving unused slots to the rest", () => {
    const make = (type: Mentionable["type"], n: number) =>
      Array.from({ length: n }, (_, i) => ({ type, id: `${type}${i}`, label: `${type}${i}`, color: null, context: null }));
    const full = pickGrouped({ GOAL: make("GOAL", 5), MILESTONE: make("MILESTONE", 5), TASK: make("TASK", 5) }, 8);
    expect(full.map((r) => r.type)).toEqual(["GOAL", "GOAL", "GOAL", "MILESTONE", "MILESTONE", "MILESTONE", "TASK", "TASK"]);
    const tasksOnly = pickGrouped({ GOAL: [], MILESTONE: make("MILESTONE", 1), TASK: make("TASK", 10) }, 8);
    expect(tasksOnly.filter((r) => r.type === "TASK")).toHaveLength(7);
  });
});

describe("mentions end to end", () => {
  it("UniqueID block ids flow through saveJournalEntry -> extractMentions -> JournalLinks -> goal reflections", async () => {
    const user = await seedUser();
    const goal = await seedGoal(user.id, { title: "Launch site" });
    const milestone = await seedMilestone(user.id, goal.id);
    const doc = generateUniqueIds(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [text("Shipped the hero for "), mention("GOAL", goal.id, "Launch site"), text(" today.")] },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [text("Next: "), mention("MILESTONE", milestone.id, "Design")] }] },
            ],
          },
        ],
      },
      journalExtensions,
    ) as Node;
    const firstBlockId = doc.content?.[0]?.attrs?.id;
    const listParagraphId = doc.content?.[1]?.content?.[0]?.content?.[0]?.attrs?.id;
    expect(typeof firstBlockId).toBe("string");

    const saved = await saveJournalEntry(user.id, "2026-11-12", { content: doc, version: 0 });
    expect(saved.linkCount).toBe(2);
    expect(saved.mentionColors).toEqual({ [goal.id]: goal.color, [milestone.id]: goal.color });

    const links = await prisma.journalLink.findMany({ orderBy: { snippet: "asc" } });
    expect(links.map((l) => [l.targetType, l.blockId, l.snippet])).toEqual([
      ["MILESTONE", listParagraphId, "Next: @Design"],
      ["GOAL", firstBlockId, "Shipped the hero for @Launch site today."],
    ]);

    // An older entry, to check newest-first order.
    await saveJournalEntry(user.id, "2026-11-10", {
      content: { type: "doc", content: [{ type: "paragraph", attrs: { id: "old" }, content: [mention("GOAL", goal.id, "Launch site")] }] },
      version: 0,
    });
    const reflections = await getGoalReflections(user.id, goal.id);
    expect(reflections.map((r) => [r.date, r.blockId, r.milestone?.id ?? null])).toEqual([
      ["2026-11-12", firstBlockId, null],
      ["2026-11-12", listParagraphId, milestone.id],
      ["2026-11-10", "old", null],
    ]);
    expect((await getJournalEntry(user.id, "2026-11-12"))?.mentionColors[goal.id]).toBe(goal.color);
    // Scoped: another user sees nothing for this goal.
    const other = await seedUser();
    expect(await getGoalReflections(other.id, goal.id)).toEqual([]);
  });
});
