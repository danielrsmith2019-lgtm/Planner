"use client";

import { useEffect } from "react";

export type UndoAction = { id: number; label: string; undo: () => void };

export const UNDO_VISIBLE_MS = 6000;

/**
 * "Moved to 9:30 AM · Undo". Bottom of the screen (above the tab bar on
 * phones), doesn't block anything, disappears after 6 seconds. Cmd/Ctrl+Z
 * runs the same undo (wired in TodayView).
 */
export default function UndoToast({ action, onDismiss }: { action: UndoAction | null; onDismiss: () => void }) {
  useEffect(() => {
    if (action === null) return;
    const timer = setTimeout(onDismiss, UNDO_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [action, onDismiss]);

  if (action === null) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(64px+var(--safe-bottom)+12px)] z-40 mx-auto flex max-w-md items-center gap-2 rounded-[16px] bg-fg py-1.5 pr-1.5 pl-4 text-white shadow-card-hover animate-in fade-in slide-in-from-bottom-2 md:bottom-6"
    >
      <p className="min-w-0 flex-1 truncate text-[14px]">{action.label}</p>
      <kbd className="hidden text-[11px] text-white/50 md:inline">Ctrl+Z</kbd>
      <button
        type="button"
        onClick={() => {
          action.undo();
          onDismiss();
        }}
        className="min-h-11 shrink-0 rounded-[10px] px-3 text-[14px] font-semibold text-bc-blue-light hover:bg-white/10"
      >
        Undo
      </button>
    </div>
  );
}
