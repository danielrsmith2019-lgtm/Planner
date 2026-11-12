"use client";

import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { useEffect, useState } from "react";
import { searchMentionablesAction } from "@/actions/journal";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Mentionable } from "@/services/mentionables";
import { createJournalExtensions } from "./extensions";
import MentionMenu, { type MentionMenuState } from "./mentions/MentionMenu";

/**
 * A small mutable port between React and the suggestion plugin, which is
 * created once with the editor. Effects push the latest state in; the plugin
 * reads it when it fires.
 */
function createMentionPort() {
  let bridge: MentionBridge | null = null;
  let picked: ((item: Mentionable) => void) | undefined;
  return {
    connect(next: MentionBridge, onPicked: ((item: Mentionable) => void) | undefined) {
      bridge = next;
      picked = onPicked;
    },
    get bridge() {
      return bridge;
    },
    get picked() {
      return picked;
    },
  };
}

type MentionBridge = {
  start: (props: SuggestionProps<Mentionable, Mentionable>) => void;
  update: (props: SuggestionProps<Mentionable, Mentionable>) => void;
  exit: () => void;
  keyDown: (props: SuggestionKeyDownProps) => boolean;
};

/**
 * The reflection editor: Tiptap with StarterKit, a placeholder, checklists,
 * UniqueID on every paragraph / heading / list item / task item, and
 * @-mentions of goals, milestones and open tasks from one Server Action
 * (searchMentionables). Light BaseCamp styling (.journal-prose), DM Sans, 16px.
 */
export default function ReflectionEditor({
  initialContent,
  onChange,
  onReady,
  autofocus = false,
  label = "Reflection",
  onContentError,
  onMentionPicked,
  menuBottomOffset = 0,
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
  /** A mention was inserted (the caller records its color for the chip). */
  onMentionPicked?: (item: Mentionable) => void;
  /** Phones: extra space under the @ sheet (e.g. the keyboard toolbar). */
  menuBottomOffset?: number;
}) {
  const [menu, setMenu] = useState<(MentionMenuState & { command: (item: Mentionable) => void }) | null>(null);
  const [selected, setSelected] = useState(0);
  const desktop = useMediaQuery("(min-width: 768px)");
  const keyboardInset = useKeyboardInset();

  // The suggestion plugin (created once) calls into this port; the effect keeps it current.
  const [port] = useState(createMentionPort);
  useEffect(() => {
    const toState = (props: SuggestionProps<Mentionable, Mentionable>) => ({
      items: props.items,
      query: props.query,
      rect: props.clientRect?.() ?? null,
      command: (item: Mentionable) => props.command(item),
    });
    port.connect({
      start: (props) => {
        setSelected(0);
        setMenu(toState(props));
      },
      update: (props) => {
        setSelected((current) => Math.min(current, Math.max(props.items.length - 1, 0)));
        setMenu(toState(props));
      },
      exit: () => setMenu(null),
      keyDown: ({ event }) => {
        const open = menu;
        const index = selected;
        if (open === null) return false;
        const count = open.items.length;
        if (event.key === "ArrowDown") {
          setSelected(count === 0 ? 0 : (index + 1) % count);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected(count === 0 ? 0 : (index - 1 + count) % count);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const item = open.items[index];
          if (item === undefined) return false;
          open.command(item);
          return true;
        }
        if (event.key === "Escape") {
          setMenu(null);
          return true;
        }
        return false;
      },
    }, onMentionPicked);
  });

  const [extensions] = useState(() =>
    createJournalExtensions({
      char: "@",
      debounce: 120,
      items: async ({ query }) => {
        const result = await searchMentionablesAction({ query });
        return result.ok ? result.data : [];
      },
      command: ({ editor, range, props }) => {
        const item = props as Mentionable;
        port.picked?.(item);
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: "mention", attrs: { id: item.id, label: item.label, targetType: item.type } },
            { type: "text", text: " " },
          ])
          .run();
      },
      render: () => ({
        onStart: (props) => port.bridge?.start(props),
        onUpdate: (props) => port.bridge?.update(props),
        onExit: () => port.bridge?.exit(),
        onKeyDown: (props) => port.bridge?.keyDown(props) ?? false,
      }),
    }),
  );

  const editor = useEditor({
    extensions,
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

  return (
    <>
      <EditorContent editor={editor} className="min-h-[200px]" />
      {menu !== null && (
        <MentionMenu
          state={menu}
          selected={selected}
          onSelect={menu.command}
          onHover={setSelected}
          mobile={!desktop}
          bottomOffset={keyboardInset + menuBottomOffset}
        />
      )}
    </>
  );
}
