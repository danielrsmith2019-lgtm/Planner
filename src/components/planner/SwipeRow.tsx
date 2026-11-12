"use client";

import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

/** Share of the row's width to pass before letting go triggers the action. */
export const SWIPE_THRESHOLD = 0.3;
/** Movement before the gesture picks an axis; vertical wins and scrolls normally. */
export const AXIS_LOCK_PX = 10;

type Axis = "x" | "y" | null;

/**
 * Swipeable task row (blueprint Section 4, "Touch interactions").
 * Right past 30%: a green Check is revealed and the task completes.
 * Left past 30%: an orange CalendarClock is revealed and the schedule sheet opens.
 * Released early, it springs back. Built on pointer events with
 * touch-action: pan-y, and the axis locks after 10px so it never fights
 * vertical scrolling. Taps after a swipe are swallowed.
 */
export default function SwipeRow({
  enabled,
  onSwipeRight,
  onSwipeLeft,
  children,
  className,
}: {
  enabled: boolean;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Width in state too, for the render-time "armed" styling (refs aren't read during render).
  const [rowWidth, setRowWidth] = useState(1);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<Axis>(null);
  const width = useRef(1);
  const swallowClick = useRef(false);
  const buzzed = useRef(false);

  const reset = () => {
    start.current = null;
    axis.current = null;
    buzzed.current = false;
    setDragging(false);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    axis.current = null;
    width.current = event.currentTarget.getBoundingClientRect().width || 1;
    setRowWidth(width.current);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (origin === null || origin.id !== event.pointerId) return;
    const moveX = event.clientX - origin.x;
    const moveY = event.clientY - origin.y;
    if (axis.current === null) {
      if (Math.abs(moveX) < AXIS_LOCK_PX && Math.abs(moveY) < AXIS_LOCK_PX) return;
      axis.current = Math.abs(moveX) > Math.abs(moveY) ? "x" : "y";
      if (axis.current === "x") {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }
    }
    if (axis.current !== "x") return;
    setDx(moveX);
    const past = Math.abs(moveX) > width.current * SWIPE_THRESHOLD;
    if (past && !buzzed.current) {
      buzzed.current = true;
      // A small tick when the action arms (Android; iOS Safari ignores it).
      navigator.vibrate?.(10);
    } else if (!past) {
      buzzed.current = false;
    }
  };

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (origin === null || origin.id !== event.pointerId) return;
    if (axis.current === "x") {
      swallowClick.current = true;
      const threshold = width.current * SWIPE_THRESHOLD;
      if (dx > threshold) onSwipeRight();
      else if (dx < -threshold) onSwipeLeft();
    }
    setDx(0);
    reset();
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const armedRight = dx > rowWidth * SWIPE_THRESHOLD;
  const armedLeft = dx < -rowWidth * SWIPE_THRESHOLD;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Revealed actions */}
      {dx !== 0 && (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-between">
          <span
            className={cn("flex h-full items-center pl-5 text-white transition-colors", armedRight ? "bg-bc-green" : "bg-bc-green/60")}
            style={{ width: Math.max(dx, 0) }}
          >
            <Icon icon="complete" size={22} strokeWidth={2.5} className={cn("transition-transform", armedRight && "scale-125")} />
          </span>
          <span
            className={cn("flex h-full items-center justify-end pr-5 text-white transition-colors", armedLeft ? "bg-bc-orange" : "bg-bc-orange/60")}
            style={{ width: Math.max(-dx, 0) }}
          >
            <Icon icon="reschedule" size={22} className={cn("transition-transform", armedLeft && "scale-125")} />
          </span>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={onClickCapture}
        className={cn("relative bg-surface", enabled && "touch-pan-y", !dragging && "transition-transform duration-200 ease-out")}
        style={{ transform: dx === 0 ? undefined : `translateX(${dx}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
