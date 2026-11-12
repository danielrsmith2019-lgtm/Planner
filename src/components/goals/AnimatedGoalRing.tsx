"use client";

import { useSyncExternalStore } from "react";
import GoalRing, { type GoalRingProps } from "@/components/shared/GoalRing";
import { formatProgressDelta, IDLE_VIEW, ringAnimations, type RingView } from "./ring-animations";

/** This goal's ring state from the app-wide ring animation store. */
export function useRingView(goalId: string): RingView {
  return useSyncExternalStore(
    ringAnimations.subscribe,
    () => ringAnimations.get(goalId),
    () => IDLE_VIEW,
  );
}

type AnimatedGoalRingProps = Omit<GoalRingProps, "sweepFrom" | "sweepKey"> & { goalId: string };

/**
 * GoalRing that plays the completion animation: while a completion is in
 * flight it holds the old value, then sweeps old -> new with a "+N%" label
 * that floats up and fades (1.2s). Every ring for the goal plays it together.
 */
export default function AnimatedGoalRing({ goalId, progress, className = "", ...ring }: AnimatedGoalRingProps) {
  const view = useRingView(goalId);
  const playing = view.playing;
  const shown = playing !== null ? playing.to : (view.held ?? progress);

  return (
    <div className={`relative shrink-0 ${className}`}>
      <GoalRing {...ring} progress={shown} sweepFrom={playing?.from} sweepKey={playing?.key} />
      {playing !== null && (
        <span key={playing.key} role="status" className="goal-ring-delta">
          {formatProgressDelta(playing.to - playing.from)}
        </span>
      )}
    </div>
  );
}
