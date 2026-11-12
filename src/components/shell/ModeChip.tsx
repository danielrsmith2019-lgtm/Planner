"use client";

import { DAY_MODES, type DayMode } from "@/lib/domain/mode";
import { useUiStore } from "@/stores/ui";

const LABELS: Record<DayMode, string> = { plan: "Plan", do: "Do", reflect: "Reflect" };

/** Compact Plan | Do | Reflect segmented control. Picking one overrides the clock for today. */
export default function ModeChip() {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);

  return (
    <div role="radiogroup" aria-label="Day mode" className="flex rounded-[12px] border-[0.5px] border-border bg-surface p-0.5">
      {DAY_MODES.map((option) => {
        const active = option === mode;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(option)}
            className={`min-h-11 min-w-11 rounded-[10px] px-2 text-[13px] max-[379px]:px-1 max-[379px]:text-[12px] sm:px-2.5 transition-colors ${
              active ? "bg-bc-blue font-semibold text-white" : "font-medium text-fg-secondary hover:text-fg"
            }`}
          >
            {LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
