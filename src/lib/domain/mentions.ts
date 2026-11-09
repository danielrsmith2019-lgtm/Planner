/**
 * Journal document parsing (blueprint Section 3, "Rich-text journal").
 *
 * Works on Tiptap's JSON output. Input arrives from the client, so every
 * function accepts `unknown` and skips anything malformed instead of throwing.
 *
 * Contracts with the editor (configured when the journal UI is built):
 * - Block ids come from Tiptap's UniqueID extension: `attrs.id` on paragraphs,
 *   headings, list items, task items, blockquotes.
 * - A mention node is `{ type: "mention", attrs: { id, label, targetType } }`
 *   where `id` is the goal, milestone or task id and `targetType` is
 *   "GOAL" | "MILESTONE" | "TASK".
 * - Mentions render in text as "@" + label (Tiptap's default), falling back to the id.
 */

export type MentionTargetType = "GOAL" | "MILESTONE" | "TASK";

export type JournalNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: unknown[];
};

export type JournalDoc = JournalNode & { type: "doc" };

export type ExtractedMention = {
  /** UniqueID of the nearest ancestor block that has one. */
  blockId: string;
  targetType: MentionTargetType;
  targetId: string;
  /** That block's plain text, whitespace collapsed, at most 280 characters. */
  snippet: string;
};

export const SNIPPET_MAX_LENGTH = 280;

const TARGET_TYPES = new Set<string>(["GOAL", "MILESTONE", "TASK"]);

/** Nodes whose children are inline content; each becomes one line of plain text. */
const TEXT_BLOCKS = new Set<string>(["paragraph", "heading", "codeBlock"]);

function asNode(value: unknown): JournalNode | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JournalNode) : null;
}

function childrenOf(node: JournalNode): JournalNode[] {
  if (!Array.isArray(node.content)) return [];
  return node.content.flatMap((child) => {
    const n = asNode(child);
    return n === null ? [] : [n];
  });
}

function stringAttr(node: JournalNode, key: string): string | null {
  const value = node.attrs?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Inline text of a node, mentions as "@label", hard breaks as "\n". */
function inlineText(node: JournalNode): string {
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention") return `@${stringAttr(node, "label") ?? stringAttr(node, "id") ?? ""}`;
  return childrenOf(node).map(inlineText).join("");
}

/** Lines of text under a node: one per text block, in document order. */
function textLines(node: JournalNode): string[] {
  if (node.type !== undefined && TEXT_BLOCKS.has(node.type)) return [inlineText(node)];
  return childrenOf(node).flatMap(textLines);
}

function toSnippet(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= SNIPPET_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, SNIPPET_MAX_LENGTH - 1).trimEnd()}…`;
}

/** Plain text of a whole document, one line per text block. For search. */
export function extractPlainText(doc: unknown): string {
  const root = asNode(doc);
  if (root === null) return "";
  return textLines(root)
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Every mention in the document, in order, one entry per mention node.
 * Mentions with an unknown targetType, no id, or no block id above them are skipped.
 */
export function extractMentions(doc: unknown): ExtractedMention[] {
  const root = asNode(doc);
  if (root === null) return [];

  const found: ExtractedMention[] = [];
  const snippetCache = new Map<JournalNode, string>();

  const walk = (node: JournalNode, nearestBlock: JournalNode | null) => {
    const block = stringAttr(node, "id") !== null && node.type !== "mention" ? node : nearestBlock;

    if (node.type === "mention") {
      const targetType = stringAttr(node, "targetType");
      const targetId = stringAttr(node, "id");
      const blockId = nearestBlock === null ? null : stringAttr(nearestBlock, "id");
      if (targetType !== null && TARGET_TYPES.has(targetType) && targetId !== null && blockId !== null && nearestBlock) {
        let snippet = snippetCache.get(nearestBlock);
        if (snippet === undefined) {
          snippet = toSnippet(textLines(nearestBlock).join(" ") || inlineText(nearestBlock));
          snippetCache.set(nearestBlock, snippet);
        }
        found.push({ blockId, targetType: targetType as MentionTargetType, targetId, snippet });
      }
      return;
    }

    for (const child of childrenOf(node)) walk(child, block);
  };

  walk(root, null);
  return found;
}
