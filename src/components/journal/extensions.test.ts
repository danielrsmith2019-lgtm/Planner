import { generateUniqueIds } from "@tiptap/extension-unique-id";
import { describe, expect, it } from "vitest";
import { extractPlainText } from "@/lib/domain/mentions";
import { journalExtensions } from "./extensions";

type Node = { type: string; attrs?: { id?: unknown }; content?: Node[] };

function collect(node: Node, out: Node[] = []): Node[] {
  out.push(node);
  for (const child of node.content ?? []) collect(child, out);
  return out;
}

describe("journal editor schema", () => {
  it("gives every paragraph, heading, list item and task item an id", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Wins" }] },
        { type: "paragraph", content: [{ type: "text", text: "Shipped the goals page." }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Ran 8 km" }] }] }] },
        {
          type: "taskList",
          content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Call Mom" }] }] }],
        },
      ],
    };
    const withIds = generateUniqueIds(doc, journalExtensions) as Node;
    const blocks = collect(withIds).filter((n) => ["paragraph", "heading", "listItem", "taskItem"].includes(n.type));
    // heading, paragraph, listItem + its paragraph, taskItem + its paragraph
    expect(blocks).toHaveLength(6);
    const ids = blocks.map((b) => b.attrs?.id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // The server's plain-text extraction reads the same documents.
    expect(extractPlainText(withIds)).toContain("Call Mom");
  });
});

describe("existing documents", () => {
  it("keeps mention nodes (the seed and future @mentions) instead of dropping the document", async () => {
    const { getSchema } = await import("@tiptap/react");
    const schema = getSchema(journalExtensions);
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { id: "b1" },
          content: [
            { type: "text", text: "Ran for " },
            { type: "mention", attrs: { id: "g1", label: "Run a sub-4 marathon", targetType: "GOAL" } },
          ],
        },
      ],
    };
    const node = schema.nodeFromJSON(doc);
    node.check();
    expect(node.toJSON()).toEqual(doc);
    expect(node.textContent).toBe("Ran for ");
  });
});
