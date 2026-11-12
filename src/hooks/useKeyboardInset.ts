"use client";

import { useEffect, useState } from "react";

/**
 * How far the on-screen keyboard covers the bottom of the layout viewport, in
 * px, from the visualViewport API (0 when closed or unsupported). A toolbar at
 * `position: fixed; bottom: <inset>px` then sits right above the keyboard.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(covered > 1 ? Math.round(covered) : 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
