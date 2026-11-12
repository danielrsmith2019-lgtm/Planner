import { TaskItem, TaskList } from "@tiptap/extension-list";
import UniqueID from "@tiptap/extension-unique-id";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { createJournalMention } from "./mentions/mention-extension";

/** Block types that get a stable attrs.id (JournalLink.blockId points at these). */
export const BLOCK_ID_TYPES = ["paragraph", "heading", "listItem", "taskItem"];

/**
 * The journal editor's extensions. The editor passes its "@" suggestion
 * config; tests and server code use the same schema without one.
 */
export function createJournalExtensions(suggestion?: Omit<SuggestionOptions, "editor">) {
  return [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    Placeholder.configure({ placeholder: "How did today go?" }),
    TaskList,
    TaskItem.configure({ nested: true }),
    UniqueID.configure({ types: BLOCK_ID_TYPES }),
    createJournalMention(suggestion),
  ];
}

export const journalExtensions = createJournalExtensions();
