"use client";

import Link from "next/link";
import GoalRing from "@/components/shared/GoalRing";
import type { GoalNode } from "@/lib/domain/goal-tree";
import { cn } from "@/utils/cn";

export type RingDelta = { goalId: string; delta: number; key: number };

/** "+3%" / "-2%", or "+0.4%" for small moves so the badge never reads +0%. */
function formatDelta(delta: number): string {
  const points = delta * 100;
  const shown = Math.abs(points) >= 1 ? Math.round(points).toString() : points.toFixed(1);
  return `${points >= 0 ? "+" : ""}${shown.replace(/^-/, "-")}%`;
}

function DeltaBadge({ delta }: { delta: RingDelta }) {
  const up = delta.delta >= 0;
  return (
    <span
      key={delta.key}
      role="status"
      className={cn(
        "bc-pill pointer-events-none absolute -top-3 -right-6 z-10 px-2 py-0.5 shadow-card animate-in fade-in zoom-in-75 slide-in-from-bottom-2 duration-300",
        up ? "bg-bc-green-light text-bc-green-dark" : "bg-surface-alt text-fg-secondary",
      )}
    >
      {formatDelta(delta.delta)}
    </span>
  );
}

/**
 * Active goals as 48px rings, on a white card so the ring track shows.
 * Phones: a horizontal strip at the top of Today.
 * 768px up: the same rings in a left rail with titles. When a completion
 * returns a delta, that goal's ring pulses and shows "+N%".
 */
export default function GoalStrip({ goals, delta }: { goals: GoalNode[]; delta: RingDelta | null }) {
  const active = goals.filter((g) => g.status === "ACTIVE");
  if (active.length === 0) {
    return (
      <Link href="/goals" className="bc-card bc-label flex min-h-11 items-center md:block">
        No active goals yet. Add one on the Goals page.
      </Link>
    );
  }
  return (
    <nav aria-label="Goals">
      {/* Phones: horizontal scroll */}
      <ul className="bc-card flex gap-3 overflow-x-auto px-3 pt-4 pb-3 md:hidden">
        {active.map((goal) => {
          const moving = delta?.goalId === goal.id ? delta : null;
          return (
            <li key={goal.id} className="shrink-0">
              <Link href={`/goals/${goal.id}`} className="relative flex w-[72px] flex-col items-center gap-1">
                <span className={cn("relative transition-transform duration-300", moving !== null && "scale-110")}>
                  <GoalRing progress={goal.progress} color={goal.color} size={48} />
                  {moving !== null && <DeltaBadge delta={moving} />}
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium text-fg-secondary">{goal.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 768px up: left rail */}
      <ul className="bc-card hidden flex-col gap-1 px-2 py-2 md:flex">
        {active.map((goal) => {
          const moving = delta?.goalId === goal.id ? delta : null;
          return (
            <li key={goal.id}>
              <Link
                href={`/goals/${goal.id}`}
                className="flex min-h-14 items-center gap-3 rounded-[12px] px-2 py-1.5 hover:bg-surface-alt"
              >
                <span className={cn("relative shrink-0 transition-transform duration-300", moving !== null && "scale-110")}>
                  <GoalRing progress={goal.progress} color={goal.color} size={48} />
                  {moving !== null && <DeltaBadge delta={moving} />}
                </span>
                <span className="line-clamp-2 min-w-0 text-[13px] font-medium leading-snug text-fg">{goal.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
