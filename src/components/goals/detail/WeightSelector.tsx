"use client";

import { cn } from "@/utils/cn";

const LABELS: Record<number, string> = { 1: "Light", 2: "Medium", 3: "Heavy" };

/** Milestone weight 1-3 as a 44px segmented control. */
export default function WeightSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (weight: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Weight" className="grid grid-cols-3 gap-1 rounded-[12px] bg-surface-alt p-1">
      {[1, 2, 3].map((weight) => (
        <button
          key={weight}
          type="button"
          role="radio"
          aria-checked={value === weight}
          disabled={disabled}
          onClick={() => onChange(weight)}
          className={cn(
            "flex min-h-11 flex-col items-center justify-center rounded-[10px] transition-colors disabled:opacity-50",
            value === weight ? "bg-surface text-fg shadow-card" : "text-fg-secondary",
          )}
        >
          <span className="text-[15px] font-semibold">{weight}</span>
          <span className="text-[11px]">{LABELS[weight]}</span>
        </button>
      ))}
    </div>
  );
}
