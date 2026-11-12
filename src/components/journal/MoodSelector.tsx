"use client";

import { MOODS } from "@/lib/domain/journal";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

/** Mood 1-5 with lucide icons (Frown, Meh, Smile, Laugh, Sparkles). Tap again to clear. */
export default function MoodSelector({ value, onChange }: { value: number | null; onChange: (mood: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Mood" className="grid grid-cols-5 gap-1.5">
      {MOODS.map((mood) => {
        const selected = value === mood.value;
        return (
          <button
            key={mood.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${mood.value}: ${mood.label}`}
            onClick={() => onChange(selected ? null : mood.value)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[12px] border transition-colors",
              selected ? "border-transparent" : "border-border bg-surface text-fg-secondary hover:bg-surface-alt",
            )}
            style={selected ? { background: `color-mix(in srgb, ${mood.color} 14%, white)`, color: mood.color } : undefined}
          >
            <Icon icon={mood.icon} size={22} strokeWidth={selected ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">{mood.label}</span>
          </button>
        );
      })}
    </div>
  );
}
