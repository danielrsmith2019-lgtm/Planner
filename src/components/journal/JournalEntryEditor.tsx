"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor, JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useId, useState } from "react";
import { saveJournalEntryAction } from "@/actions/journal";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import type { LocalDate } from "@/lib/domain/dates";
import { EMPTY_DOC, monthOf } from "@/lib/domain/journal";
import { journalQuery } from "@/queries/journal";
import { queryKeys } from "@/queries/keys";
import type { JournalEntryDTO } from "@/services/journal";
import { cn } from "@/utils/cn";
import { createAutosaver, type AutosaveStatus, type SaveOutcome, type SaveRequest } from "./autosave";
import EditorToolbar from "./EditorToolbar";
import { MentionColorsContext } from "./mentions/MentionColors";
import MoodSelector from "./MoodSelector";
import ReflectionEditor from "./ReflectionEditor";

export type ToolbarPlacement = "inline" | "keyboard";

/** Height of the keyboard-pinned toolbar on phones; the @ sheet sits above it. */
const KEYBOARD_TOOLBAR_PX = 54;

/**
 * A day's journal entry: the reflection editor with autosave, tomorrow's
 * intention, and mood. Used in the right pane of /today (desktop) and on
 * /journal/[date]. On phones the toolbar sits above the keyboard.
 */
export default function JournalEntryEditor({
  date,
  toolbar = "inline",
  onStatus,
  autofocus = false,
  focusBlockId = null,
}: {
  date: LocalDate;
  toolbar?: ToolbarPlacement;
  /** Lets a page show the save status in its own header. */
  onStatus?: (status: AutosaveStatus) => void;
  autofocus?: boolean;
  /** Scroll to and highlight this block (a goal's Reflections link). */
  focusBlockId?: string | null;
}) {
  const entry = useQuery(journalQuery(date));
  const [reloads, setReloads] = useState(0);

  if (entry.isPending) return <div className="bc-skeleton h-48 rounded-[12px]" aria-hidden="true" />;
  if (entry.isError) {
    return (
      <p className="bc-label" role="alert">
        Couldn&apos;t load this entry: {entry.error.message}
      </p>
    );
  }
  return (
    <EntryForm
      // A reload (after "changed on another device") starts fresh from the server's copy.
      key={`${date}:${reloads}`}
      date={date}
      entry={entry.data}
      toolbar={toolbar}
      onStatus={onStatus}
      autofocus={autofocus}
      focusBlockId={focusBlockId}
      onReload={async () => {
        await entry.refetch();
        setReloads((n) => n + 1);
      }}
    />
  );
}

/** A deep copy with ordinary prototypes, safe to send to a Server Action. */
export function toPlainJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function statusText(status: AutosaveStatus): string {
  switch (status.state) {
    case "pending":
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "error":
      return "Not saved yet";
    default:
      return "";
  }
}

export function SaveStatus({ status, className }: { status: AutosaveStatus; className?: string }) {
  return (
    <span aria-live="polite" className={cn("bc-caption", status.state === "error" && "text-bc-red-dark", className)}>
      {statusText(status)}
    </span>
  );
}

function EntryForm({
  date,
  entry,
  toolbar,
  onStatus,
  autofocus,
  focusBlockId,
  onReload,
}: {
  date: LocalDate;
  entry: JournalEntryDTO | null;
  toolbar: ToolbarPlacement;
  onStatus?: (status: AutosaveStatus) => void;
  autofocus: boolean;
  focusBlockId: string | null;
  onReload: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutosaveStatus>({ state: "idle" });
  const [intention, setIntention] = useState(entry?.intention ?? "");
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reloading, setReloading] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [mentionColors, setMentionColors] = useState<ReadonlyMap<string, string>>(
    () => new Map(Object.entries(entry?.mentionColors ?? {})),
  );
  const keyboardInset = useKeyboardInset();
  const intentionId = useId();
  const initialContent = (entry?.content ?? EMPTY_DOC) as JSONContent;

  const [saver] = useState(() =>
    createAutosaver({
      initialContent,
      initialVersion: entry?.version ?? 0,
      save: async (request: SaveRequest): Promise<SaveOutcome> => {
        // ProseMirror builds node attrs with Object.create(null). React won't send
        // null-prototype objects to a Server Action as plain data, so round-trip
        // through JSON first.
        const result = await saveJournalEntryAction({ date, ...request, content: toPlainJson(request.content) });
        if (result.ok) {
          queryClient.setQueryData(queryKeys.journal(date), result.data);
          void queryClient.invalidateQueries({ queryKey: queryKeys.journalMonth(monthOf(date)) });
          // New or removed mentions change goals' Reflections timelines.
          void queryClient.invalidateQueries({ queryKey: ["goalReflections"] });
          return { ok: true, version: result.data.version };
        }
        if (result.error.code === "STALE") return { ok: false, stale: true, currentVersion: result.error.currentVersion ?? null };
        return { ok: false, stale: false, message: result.error.message };
      },
      onStatus: setStatus,
    }),
  );

  useEffect(() => onStatus?.(status), [status, onStatus]);

  // Opened from a goal's Reflections: scroll to that block and flash it. The
  // flash is a temporary style rule, because ProseMirror redraws its own DOM
  // and would drop a class added by hand.
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (editor === null || focusBlockId === null) return;
    let clear: number | undefined;
    const frame = requestAnimationFrame(() => {
      const block = editor.view.dom.querySelector(`[data-id="${CSS.escape(focusBlockId)}"]`);
      if (!(block instanceof HTMLElement)) return;
      block.scrollIntoView({ block: "center", behavior: "smooth" });
      setFlashing(true);
      clear = window.setTimeout(() => setFlashing(false), 2400);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (clear !== undefined) window.clearTimeout(clear);
    };
  }, [editor, focusBlockId]);

  // Save right away when the tab is hidden or this entry closes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void saver.flushNow();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void saver.flushNow();
      saver.dispose();
    };
  }, [saver]);

  const onContent = useCallback(
    (content: JSONContent) => {
      if (!unreadable) saver.change({ content });
    },
    [saver, unreadable],
  );
  // Stale (changed elsewhere) or unreadable content: stop all editing and saving.
  const stale = status.state === "stale";
  const locked = stale || unreadable;

  return (
    <div className="flex flex-col gap-5">
      {flashing && focusBlockId !== null && (
        <style>{`.journal-prose [data-id="${focusBlockId.replace(/["\\]/g, "")}"] { animation: journal-flash 2.4s ease-out; border-radius: 6px; }`}</style>
      )}
      {stale && (
        <div role="alert" className="flex items-center gap-3 rounded-[14px] bg-bc-orange-light py-1 pr-1 pl-4 text-bc-orange-dark">
          <p className="flex-1 py-2 text-[14px] font-medium">This entry changed on another device.</p>
          <button
            type="button"
            disabled={reloading}
            onClick={async () => {
              setReloading(true);
              await onReload();
            }}
            className="min-h-11 shrink-0 rounded-[10px] bg-white px-4 text-[14px] font-semibold text-bc-orange-dark disabled:opacity-50"
          >
            {reloading ? "Reloading" : "Reload"}
          </button>
        </div>
      )}

      {unreadable && (
        <p role="alert" className="rounded-[14px] bg-bc-orange-light px-4 py-3 text-[14px] font-medium text-bc-orange-dark">
          This entry has content this version of the editor can&apos;t show. It&apos;s saved and unchanged; editing is off for it.
        </p>
      )}

      {toolbar === "inline" && <EditorToolbar editor={editor} className="-ml-2 border-b border-border pb-1" />}

      <div className={cn(locked && "pointer-events-none opacity-60")} aria-disabled={locked}>
        <MentionColorsContext value={mentionColors}>
        <ReflectionEditor
          initialContent={initialContent}
          onChange={onContent}
          onReady={setEditor}
          autofocus={autofocus}
          onMentionPicked={(item) => {
            if (item.color !== null) setMentionColors((current) => new Map(current).set(item.id, item.color ?? ""));
          }}
          menuBottomOffset={toolbar === "keyboard" ? KEYBOARD_TOOLBAR_PX : 0}
          onContentError={() => {
            saver.dispose();
            setUnreadable(true);
          }}
        />
        </MentionColorsContext>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={intentionId} className="bc-label text-fg">
          One intention for tomorrow
        </label>
        <input
          id={intentionId}
          value={intention}
          disabled={locked}
          maxLength={500}
          onChange={(e) => {
            setIntention(e.target.value);
            saver.change({ intention: e.target.value.trim() === "" ? null : e.target.value });
          }}
          placeholder="Finish the case study draft"
          className="bc-input min-h-11 text-[16px]"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="bc-label text-fg">Mood</p>
        <MoodSelector
          value={mood}
          onChange={(next) => {
            if (locked) return;
            setMood(next);
            saver.change({ mood: next });
          }}
        />
      </div>

      {toolbar === "keyboard" && (
        <>
          {/* Room so the last field isn't hidden behind the toolbar. */}
          <div className="h-16" aria-hidden="true" />
          <div
            className="fixed inset-x-0 z-[60] border-t border-border bg-surface/95 px-3 py-1 backdrop-blur-md"
            style={{ bottom: keyboardInset, paddingBottom: keyboardInset > 0 ? 4 : "calc(4px + var(--safe-bottom))" }}
          >
            <EditorToolbar editor={editor} />
          </div>
        </>
      )}
    </div>
  );
}
