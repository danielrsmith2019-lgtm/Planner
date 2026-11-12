import { describe, expect, it } from "vitest";
import { seedUser } from "../../test/seed";
import { ValidationError } from "./errors";
import { listJournalDays, saveJournalEntry } from "./journal";

const doc = (text: string) => ({ type: "doc", content: text === "" ? [{ type: "paragraph" }] : [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("listJournalDays", () => {
  it("lists the month's entries with mood and whether they have text", async () => {
    const user = await seedUser();
    await saveJournalEntry(user.id, "2026-10-31", { content: doc("October"), version: 0 });
    await saveJournalEntry(user.id, "2026-11-03", { content: doc("Good day"), version: 0, mood: 4 });
    await saveJournalEntry(user.id, "2026-11-12", { content: doc(""), version: 0, mood: 2 });
    const other = await seedUser();
    await saveJournalEntry(other.id, "2026-11-05", { content: doc("Not mine"), version: 0 });

    expect(await listJournalDays(user.id, "2026-11-01", "2026-11-30")).toEqual([
      { date: "2026-11-03", mood: 4, hasText: true },
      { date: "2026-11-12", mood: 2, hasText: false },
    ]);
  });

  it("rejects bad ranges", async () => {
    const user = await seedUser();
    await expect(listJournalDays(user.id, "2026-11-30", "2026-11-01")).rejects.toBeInstanceOf(ValidationError);
    await expect(listJournalDays(user.id, "nope", "2026-11-01")).rejects.toBeInstanceOf(ValidationError);
  });
});
