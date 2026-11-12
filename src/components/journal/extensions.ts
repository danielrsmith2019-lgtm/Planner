import { TaskItem, TaskList } from "@tiptap/extension-list";
import UniqueID from "@tiptap/extension-unique-id";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { JournalMention } from "./mention-node";

/** Block types that get a stable attrs.id (JournalLink.blockId points at these). */
export const BLOCK_ID_TYPES = ["paragraph", "heading", "listItem", "taskItem"];

/** The journal editor's extensions, in one place so tests use the same schema. */
export const journalExtensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Placeholder.configure({ placeholder: "How did today go?" }),
  TaskList,
  TaskItem.configure({ nested: true }),
  UniqueID.configure({ types: BLOCK_ID_TYPES }),
  JournalMention,
];
