/**
 * GoalRing: circular goal progress, ported from BaseCamp's ProgressRing (light).
 * Changes from BaseCamp: progress is 0..1 (matches the domain layer), the color
 * is the goal's color instead of a green/blue/orange threshold, and it adds an
 * optional stalled dot. Track stays BaseCamp's #F2F2F7 with a solid stroke.
 * No hooks, so it works in Server and Client Components.
 */

import { GOAL_COLORS } from "@/lib/domain/goal-colors";

export type GoalRingProps = {
  /** 0..1 */
  progress: number;
  /** Goal accent. Defaults to the first goal color. */
  color?: string;
  /** Diameter in px. Strip = 48, card = 56. */
  size?: number;
  strokeWidth?: number;
  /** Show the % in the center. */
  showValue?: boolean;
  label?: string;
  sublabel?: string;
  /** Small orange dot for stalled goals. */
  stalled?: boolean;
  className?: string;
};

export default function GoalRing({
  progress,
  color = GOAL_COLORS[0],
  size = 56,
  strokeWidth,
  showValue = true,
  label,
  sublabel,
  stalled = false,
  className = "",
}: GoalRingProps) {
  const stroke = strokeWidth ?? (size >= 72 ? 6 : size >= 56 ? 5 : 4);
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const offset = circumference * (1 - clamped);
  const percent = Math.round(clamped * 100);
  const valueSize = size >= 96 ? 20 : size >= 72 ? 14 : 12;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${label ? `${label}: ` : ""}${percent}% complete${stalled ? ", stalled" : ""}`}
      >
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F2F2F7" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>

        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-bold text-fg"
              style={{ fontSize: valueSize, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
            >
              {percent}%
            </span>
          </div>
        )}

        {stalled && (
          <span
            className="absolute right-0 top-0 size-2.5 rounded-full bg-stalled ring-2 ring-surface"
            aria-hidden="true"
          />
        )}
      </div>

      {label && (
        <p
          className="mt-2 truncate text-center text-xs font-medium text-fg"
          style={{ maxWidth: Math.max(size, 64) }}
        >
          {label}
        </p>
      )}
      {sublabel && <p className="mt-0.5 text-center text-[10px] text-fg-tertiary">{sublabel}</p>}
    </div>
  );
}
