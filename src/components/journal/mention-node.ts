import { mergeAttributes, Node } from "@tiptap/react";

/**
 * Mentions already in a document ({ type: "mention", attrs: { id, label,
 * targetType } }, the contract in src/lib/domain/mentions.ts) render as
 * "@label" chips and round-trip unchanged. Typing "@" to insert one (the
 * suggestion picker) comes with the mentions feature; it can replace this
 * node with @tiptap/extension-mention as long as it keeps the same name and
 * attributes.
 */
export const JournalMention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-id"), renderHTML: (a) => ({ "data-id": a.id }) },
      label: { default: null, parseHTML: (el) => el.getAttribute("data-label"), renderHTML: (a) => ({ "data-label": a.label }) },
      targetType: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-target-type"),
        renderHTML: (a) => ({ "data-target-type": a.targetType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = typeof node.attrs.label === "string" ? node.attrs.label : String(node.attrs.id ?? "");
    return ["span", mergeAttributes({ "data-type": "mention", class: "journal-mention" }, HTMLAttributes), `@${label}`];
  },

  renderText({ node }) {
    return `@${typeof node.attrs.label === "string" ? node.attrs.label : String(node.attrs.id ?? "")}`;
  },
});
