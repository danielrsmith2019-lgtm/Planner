"use client";

import { useEffect } from "react";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";

/**
 * Placeholder for Quick add (natural-language capture arrives in Iteration 3).
 * Bottom sheet on phones, centered dialog on larger screens. Esc closes it.
 */
export default function QuickAddSheet() {
  const open = useUiStore((s) => s.quickAddOpen);
  const close = useUiStore((s) => s.closeQuickAdd);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label="Close quick add" onClick={close} className="absolute inset-0 bg-black/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        className="relative w-full rounded-t-[24px] bg-surface px-5 pb-[calc(24px+var(--safe-bottom))] pt-3 shadow-card md:max-w-md md:rounded-[24px] md:pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="quick-add-title" className="bc-section-title">
            Quick add
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt">
            <Icon icon="close" size={20} />
          </button>
        </div>
        <p className="bc-label mt-2">
          Type things like &quot;Long run 16km sat 7am @marathon&quot; and they land on the right day and goal. Coming in a later build.
        </p>
      </div>
    </div>
  );
}
