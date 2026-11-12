import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import MentionChip from "./MentionChip";

export type MentionAttrs = { id: string; label: string; targetType: "GOAL" | "MILESTONE" | "TASK" };

/**
 * Tiptap Mention, stored as { type: "mention", attrs: { id, label,
 * targetType } } (the contract extractMentions reads). Rendered by MentionChip.
 * Plain text and HTML render as "@label".
 */
export function createJournalMention(suggestion?: Omit<SuggestionOptions, "editor">) {
  const extension = Mention.extend({
    addAttributes() {
      return {
        id: { default: null, parseHTML: (el) => el.getAttribute("data-id"), renderHTML: (a) => (a.id ? { "data-id": a.id } : {}) },
        label: {
          default: null,
          parseHTML: (el) => el.getAttribute("data-label"),
          renderHTML: (a) => (a.label ? { "data-label": a.label } : {}),
        },
        targetType: {
          default: null,
          parseHTML: (el) => el.getAttribute("data-target-type"),
          renderHTML: (a) => (a.targetType ? { "data-target-type": a.targetType } : {}),
        },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(MentionChip, { as: "span" });
    },
  });
  return extension.configure({
    renderText: ({ node }) => `@${typeof node.attrs.label === "string" ? node.attrs.label : String(node.attrs.id ?? "")}`,
    renderHTML: ({ node }) => [
      "span",
      { "data-type": "mention", "data-id": node.attrs.id, "data-label": node.attrs.label, "data-target-type": node.attrs.targetType },
      `@${typeof node.attrs.label === "string" ? node.attrs.label : String(node.attrs.id ?? "")}`,
    ],
    deleteTriggerWithBackspace: true,
    ...(suggestion === undefined ? {} : { suggestion }),
  });
}
