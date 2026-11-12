"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "@/utils/cn";
import { Icon, type IconName } from "@/utils/icons";

type Tool = { name: string; icon: IconName; isActive: (e: Editor) => boolean; run: (e: Editor) => void };

const TOOLS: Tool[] = [
  { name: "Bold", icon: "bold", isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { name: "Bulleted list", icon: "bulletList", isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { name: "Checklist", icon: "checklist", isActive: (e) => e.isActive("taskList"), run: (e) => e.chain().focus().toggleTaskList().run() },
  {
    name: "Heading",
    icon: "heading",
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
];

/** Bold, list, checklist, heading. 44px buttons; pressed state follows the cursor. */
export default function EditorToolbar({ editor, className }: { editor: Editor | null; className?: string }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => (e === null ? TOOLS.map(() => false) : TOOLS.map((tool) => tool.isActive(e))),
  });
  return (
    <div role="toolbar" aria-label="Formatting" className={cn("flex items-center gap-1", className)}>
      {TOOLS.map((tool, index) => (
        <button
          key={tool.name}
          type="button"
          aria-label={tool.name}
          aria-pressed={active?.[index] ?? false}
          disabled={editor === null}
          // Keep focus (and the keyboard) in the editor.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor !== null && tool.run(editor)}
          className={cn(
            "flex size-11 items-center justify-center rounded-[10px] transition-colors disabled:opacity-40",
            active?.[index] === true ? "bg-bc-blue/10 text-bc-blue" : "text-fg-secondary hover:bg-surface-alt",
          )}
        >
          <Icon icon={tool.icon} size={20} />
        </button>
      ))}
    </div>
  );
}
