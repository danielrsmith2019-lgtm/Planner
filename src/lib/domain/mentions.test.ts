import { describe, expect, it } from "vitest";
import { SNIPPET_MAX_LENGTH, extractMentions, extractPlainText, type JournalDoc } from "./mentions";

const text = (value: string) => ({ type: "text", text: value });
const mention = (targetType: string, id: string, label: string) => ({
  type: "mention",
  attrs: { id, label, targetType },
});
const paragraph = (id: string | null, ...content: object[]) => ({
  type: "paragraph",
  ...(id === null ? {} : { attrs: { id } }),
  content,
});

describe("extractMentions", () => {
  it("returns nothing for an empty document", () => {
    expect(extractMentions({ type: "doc", content: [] })).toEqual([]);
    expect(extractMentions({ type: "doc" })).toEqual([]);
  });

  it("returns one entry per mention, with its block's id and text", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [paragraph("p1", text("Easy 8k for "), mention("GOAL", "g1", "Marathon"), text(" today."))],
    };
    expect(extractMentions(doc)).toEqual([
      { blockId: "p1", targetType: "GOAL", targetId: "g1", snippet: "Easy 8k for @Marathon today." },
    ]);
  });

  it("returns two entries for two mentions in one block, sharing the snippet", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [
        paragraph(
          "p1",
          text("Skipped "),
          mention("TASK", "t1", "Long run"),
          text(" so "),
          mention("MILESTONE", "m1", "First half marathon"),
          text(" slips a week."),
        ),
      ],
    };
    const snippet = "Skipped @Long run so @First half marathon slips a week.";
    expect(extractMentions(doc)).toEqual([
      { blockId: "p1", targetType: "TASK", targetId: "t1", snippet },
      { blockId: "p1", targetType: "MILESTONE", targetId: "m1", snippet },
    ]);
  });

  it("uses the nearest block in nested lists", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              attrs: { id: "li-outer" },
              content: [
                paragraph("p-outer", text("Portfolio "), mention("GOAL", "g2", "Portfolio")),
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      attrs: { id: "li-inner" },
                      content: [paragraph("p-inner", text("Case study draft "), mention("TASK", "t9", "Write case study"))],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual([
      { blockId: "p-outer", targetType: "GOAL", targetId: "g2", snippet: "Portfolio @Portfolio" },
      { blockId: "p-inner", targetType: "TASK", targetId: "t9", snippet: "Case study draft @Write case study" },
    ]);
  });

  it("falls back to the next ancestor with an id when the paragraph has none", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { id: "ti1", checked: false },
              content: [paragraph(null, text("Ship "), mention("MILESTONE", "m4", "Launch"))],
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual([
      { blockId: "ti1", targetType: "MILESTONE", targetId: "m4", snippet: "Ship @Launch" },
    ]);
  });

  it("finds mentions inside headings and blockquotes", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { id: "h1", level: 2 }, content: [text("Week of "), mention("GOAL", "g3", "Read 12 books")] },
        { type: "blockquote", attrs: { id: "q1" }, content: [paragraph("p2", mention("TASK", "t2", "Finish chapter 4"))] },
      ],
    };
    expect(extractMentions(doc).map((m) => m.blockId)).toEqual(["h1", "p2"]);
  });

  it("caps the snippet at 280 characters", () => {
    const long = "x".repeat(400);
    const [entry] = extractMentions({ type: "doc", content: [paragraph("p1", text(long), mention("GOAL", "g1", "Goal"))] });
    expect(SNIPPET_MAX_LENGTH).toBe(280);
    expect(entry.snippet).toHaveLength(280);
    expect(entry.snippet.endsWith("…")).toBe(true);
  });

  it("collapses whitespace and line breaks in the snippet", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [paragraph("p1", text("  Tired   legs"), { type: "hardBreak" }, text("but "), mention("GOAL", "g1", "Marathon"))],
    };
    expect(extractMentions(doc)[0].snippet).toBe("Tired legs but @Marathon");
  });

  it("skips mentions it can't use: unknown type, missing id, or no block id anywhere", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [
        paragraph("p1", mention("PROJECT", "x1", "Nope"), { type: "mention", attrs: { label: "No id", targetType: "GOAL" } }),
        paragraph(null, mention("GOAL", "g1", "Orphan")),
      ],
    };
    expect(extractMentions(doc)).toEqual([]);
  });

  it("ignores malformed input instead of throwing", () => {
    expect(extractMentions(null)).toEqual([]);
    expect(extractMentions("not a doc")).toEqual([]);
    expect(extractMentions({ type: "doc", content: [null, 4, { content: "nope" }] })).toEqual([]);
  });
});

describe("extractPlainText", () => {
  it("puts each text block on its own line", () => {
    const doc: JournalDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { id: "h1", level: 2 }, content: [text("Reflection")] },
        paragraph("p1", text("Easy run with "), mention("GOAL", "g1", "Marathon"), text(".")),
        {
          type: "bulletList",
          content: [
            { type: "listItem", attrs: { id: "l1" }, content: [paragraph("p2", text("One"))] },
            { type: "listItem", attrs: { id: "l2" }, content: [paragraph("p3", text("Two"))] },
          ],
        },
        paragraph("p4"),
      ],
    };
    expect(extractPlainText(doc)).toBe("Reflection\nEasy run with @Marathon.\nOne\nTwo");
  });

  it("turns hard breaks into new lines", () => {
    const doc: JournalDoc = { type: "doc", content: [paragraph("p1", text("a"), { type: "hardBreak" }, text("b"))] };
    expect(extractPlainText(doc)).toBe("a\nb");
  });

  it("uses the id when a mention has no label", () => {
    const doc: JournalDoc = { type: "doc", content: [paragraph("p1", { type: "mention", attrs: { id: "g1", targetType: "GOAL" } })] };
    expect(extractPlainText(doc)).toBe("@g1");
  });

  it("is empty for an empty or malformed document", () => {
    expect(extractPlainText({ type: "doc", content: [] })).toBe("");
    expect(extractPlainText(undefined)).toBe("");
  });
});
