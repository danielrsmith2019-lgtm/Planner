"use client";

import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import { useEffect } from "react";
import { journalExtensions } from "./extensions";

/**
 * The reflection editor: Tiptap with StarterKit, a placeholder, checklists,
 * and UniqueID so every paragraph, heading, list item and task item keeps a
 * stable attrs.id across edits. Light BaseCamp styling (.journal-prose in
 * globals.css), DM Sans, 16px so iOS doesn't zoom.
 */
export default function ReflectionEditor({
  initialContent,
  onChange,
  onReady,
  autofocus = false,
  label = "Reflection",
  onContentError,
}: {
  initialContent: JSONContent;
  onChange: (content: JSONContent) => void;
  /** Hands the editor to a toolbar. */
  onReady?: (editor: Editor | null) => void;
  autofocus?: boolean;
  label?: string;
  /**
   * The stored document has something this editor's schema can't represent.
   * The caller must stop autosaving, or the entry would be overwritten.
   */
  onContentError?: () => void;
}) {
  const editor = useEditor({
    extensions: journalExtensions,
    content: initialContent,
    // Next renders on the server first; build the editor on the client only.
    immediatelyRender: false,
    autofocus: autofocus ? "end" : false,
    // Never silently drop content we don't understand: report it instead.
    enableContentCheck: true,
    onContentError: ({ editor: e, disableCollaboration }) => {
      disableCollaboration();
      e.setEditable(false, false);
      onContentError?.();
    },
    editorProps: {
      attributes: { class: "journal-prose", "aria-label": label, role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  return <EditorContent editor={editor} className="min-h-[200px]" />;
}
